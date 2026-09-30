import { anthropic } from '@ai-sdk/anthropic';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai';
import { getMCPClient } from '@/lib/mcp/mcpClient';
import { convertMCPToolsToAISDK } from '@/lib/mcp/toolConverter';
import { createSyntheticTools } from '@/lib/mcp/syntheticTools';
import { listAllPrompts, formatPromptsForDisplay } from '@/lib/mcp/promptManager';
import { SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildDataContext, formatContextForPrompt } from '@/lib/context/dataContext';
import { shouldSummarize, calculateContextSize } from '@/lib/utils/tokenCounter';
import { summarizeOlderMessages, createSummaryMessage } from '@/lib/summarization/summarizer';
import { extractPlanFromText, createPlanFromStep, savePlan } from '@/lib/cache/planCache';
import { createModelProvider } from '@/lib/models/provider-factory';
import { getModelById, getDefaultModel } from '@/lib/models/registry';
import { generateVirtualFilesystem } from '@/lib/mcp/codeEnvironment/filesystemGenerator';
import { generateFilesystemTree, listDirectory, readFile } from '@/lib/mcp/codeEnvironment/virtualFilesystem';
import { createMCPBridge } from '@/lib/mcp/codeEnvironment/mcpBridge';
import { executeCode } from '@/lib/sandbox/codeExecutor';
import { jsonSchema } from '@ai-sdk/provider-utils';
import type { Tool } from '@ai-sdk/provider-utils';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { messages } = json as { messages: UIMessage[] };

    // Extract model selection from URL query parameters (fallback to default)
    const url = new URL(request.url);
    const modelId = url.searchParams.get('modelId');
    const selectedModelId = modelId || getDefaultModel().id;

    console.log('\n' + '='.repeat(80));
    console.log('[Model Selection] 📥 Request received');
    console.log('[Model Selection] 🔗 URL:', request.url);
    console.log('[Model Selection] 📦 Query param modelId:', modelId);
    console.log('[Model Selection] 🎯 Selected model ID:', selectedModelId);
    console.log('='.repeat(80));

    // Validate and get model configuration
    const modelConfig = getModelById(selectedModelId);
    console.log('[Model Selection] 🔍 Model config lookup:', {
      requestedId: selectedModelId,
      found: !!modelConfig,
      config: modelConfig ? {
        id: modelConfig.id,
        name: modelConfig.name,
        provider: modelConfig.provider,
        status: modelConfig.status,
        endpoint: modelConfig.endpoint
      } : null
    });

    if (!modelConfig) {
      console.error('[Model Selection] ❌ Model not found:', selectedModelId, '- falling back to default');
      const defaultModel = getDefaultModel();
      var model = createModelProvider(defaultModel.id);
      var activeModelId = defaultModel.id;
    } else if (modelConfig.status === 'unavailable') {
      console.warn('[Model Selection] ⚠️ Model unavailable:', selectedModelId, '- falling back to default');
      const defaultModel = getDefaultModel();
      var model = createModelProvider(defaultModel.id);
      var activeModelId = defaultModel.id;
    } else {
      // Create model provider
      try {
        console.log('[Model Selection] 🔨 Creating provider for:', selectedModelId, 'with config:', {
          provider: modelConfig.provider,
          endpoint: modelConfig.endpoint || 'default'
        });
        var model = createModelProvider(selectedModelId);
        var activeModelId = selectedModelId;
        console.log('[Model Selection] ✅ Successfully created provider for:', selectedModelId);
      } catch (error) {
        console.error('[Model Selection] ❌ Error creating provider:', error, '- falling back to default');
        const defaultModel = getDefaultModel();
        model = createModelProvider(defaultModel.id);
        activeModelId = defaultModel.id;
      }
    }

    console.log('[Model Selection] 🎯 FINAL ACTIVE MODEL:', activeModelId);
    console.log('='.repeat(80) + '\n');

    // Get MCP client and convert tools to AI SDK format
    console.log('[MCP Initialization] 🔌 Starting MCP client connection...');
    const mcpStartTime = Date.now();
    const mcpClient = await getMCPClient();
    const mcpConnectTime = Date.now() - mcpStartTime;
    console.log(`[MCP Initialization] ✅ MCP client connected in ${mcpConnectTime}ms`);

    console.log('[MCP Initialization] 🔧 Fetching active sessions...');
    const sessions = mcpClient.getAllActiveSessions();
    const serverNames = Object.keys(sessions);
    console.log(`[MCP Initialization] 📊 Found ${serverNames.length} active session(s):`, serverNames.join(', '));

    // CODE EXECUTION MODE: Generate virtual filesystem instead of loading all tools
    console.log('[Code Environment] 🗂️  Generating virtual filesystem from MCP sessions...');
    const fsStartTime = Date.now();
    const virtualFS = generateVirtualFilesystem(sessions);
    const fsGenTime = Date.now() - fsStartTime;
    const fileCount = Object.keys(virtualFS.files).length;
    console.log(`[Code Environment] ✅ Generated virtual filesystem with ${fileCount} files in ${fsGenTime}ms`);

    // Create MCP bridge for sandbox
    console.log('[Code Environment] 🌉 Creating MCP bridge...');
    const mcpBridge = createMCPBridge(sessions);
    console.log('[Code Environment] ✅ MCP bridge ready');

    // Create code execution tools (only 3 tools vs 350+!)
    console.log('[Code Environment] 🛠️  Creating code execution tools...');
    const tools: Record<string, Tool> = {
      execute_code: {
        description: 'Execute TypeScript code with access to MCP servers via imports. Use this to call MCP tools by writing code that imports and uses them.',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'TypeScript code to execute. Can import MCP tools from ./servers/{server_name}/{tool_name}'
            }
          },
          required: ['code']
        }),
        execute: async ({ code }: { code: string }) => {
          console.log('[Code Execution] 🚀 Executing code in sandbox...');
          const result = await executeCode(code, virtualFS, mcpBridge);
          console.log('[Code Execution]', result.success ? '✅ Success' : '❌ Failed', `(${result.executionTime}ms)`);

          if (!result.success) {
            return `Execution failed: ${result.error}\n\nOutput:\n${result.output}`;
          }

          return result.output || String(result.returnValue);
        }
      },

      list_servers: {
        description: 'List all available MCP servers in the code environment',
        inputSchema: jsonSchema({
          type: 'object'
        }),
        execute: async () => {
          const servers = listDirectory(virtualFS, '/workspace/servers');
          return `Available MCP servers:\n${servers.map(s => `- ${s}`).join('\n')}`;
        }
      },

      read_tool_definition: {
        description: 'Read the TypeScript definition for a specific MCP tool to understand its interface',
        inputSchema: jsonSchema({
          type: 'object',
          properties: {
            server_name: {
              type: 'string',
              description: 'Server name (e.g., biocontext_hub)'
            },
            tool_name: {
              type: 'string',
              description: 'Tool name (e.g., bc_get_uniprot_protein_info)'
            }
          },
          required: ['server_name', 'tool_name']
        }),
        execute: async ({ server_name, tool_name }: { server_name: string; tool_name: string }) => {
          try {
            const path = `/workspace/servers/${server_name}/${tool_name}.ts`;
            const content = readFile(virtualFS, path);
            return content;
          } catch (error) {
            return `Tool not found: ${server_name}/${tool_name}\n\nUse list_servers() to see available servers, then list files in that server's directory.`;
          }
        }
      }
    };

    // Add synthetic tools for resources/prompts (keep these)
    console.log('[Code Environment] 🎨 Adding synthetic tools...');
    const syntheticTools = await createSyntheticTools(sessions);
    Object.assign(tools, syntheticTools);

    console.log(`[Code Environment] 🎉 TOTAL: ${Object.keys(tools).length} meta-tools (vs ${Object.keys(sessions).flatMap(s => sessions[s].connector.tools).length} original tools)`);

    // List available prompts for context
    const promptsList = await listAllPrompts(sessions);
    const promptsContext = promptsList.totalCount > 0
      ? formatPromptsForDisplay(promptsList.prompts)
      : '';

    let stepCount = 0;

    // Build data context from message history
    const dataContext = buildDataContext(messages);
    const contextPrompt = formatContextForPrompt(dataContext);

    // Create UI message stream with tool call support
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {

        // Generate filesystem tree for context
        const filesystemTree = generateFilesystemTree(virtualFS);

        // Build system prompt with code environment documentation
        const codeEnvDocs = `
## MCP Code Execution Environment

⚠️ **CRITICAL**: You do NOT have direct access to MCP tools. You can ONLY access them through code execution.

### Your Available Tools (Only 3!)

1. **execute_code** - Execute TypeScript code to call MCP tools
2. **list_servers** - List available MCP servers
3. **read_tool_definition** - Read a specific tool's interface

❌ **DO NOT** try to call tools directly - they are NOT available as direct tools!
✅ **DO** use \`execute_code\` to import and call them

⚠️ **CRITICAL**: Tool names are LONG (e.g., \`biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info\`)
- ALWAYS use \`read_tool_definition\` first to get the exact name
- NEVER abbreviate or shorten tool names in imports
- Use the EXACT name shown in the tool definition

### Code Execution Rules (CRITICAL)

⚠️ **DO NOT wrap code in async functions** - write code directly with top-level await!

This pattern is from Anthropic's official MCP documentation.

❌ **WRONG**:
\`\`\`typescript
async function getData() {
  const result = await tool(...);
  console.log(result);
}
getData(); // Returns undefined!
\`\`\`

✅ **CORRECT** - Write code directly:
\`\`\`typescript
const result = await tool(...);
console.log(result);
\`\`\`

### Available Servers

\`\`\`
${filesystemTree}
\`\`\`

### How to Use MCP Tools (REQUIRED WORKFLOW)

1. **Read tool definition first** to get the EXACT tool name and parameters:
   \`\`\`typescript
   read_tool_definition({
     server_name: "biocontext_hub",
     tool_name: "biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info"
   })
   \`\`\`

   ⚠️ **CRITICAL**: The tool definition shows the EXACT tool name you must use in imports!

2. **Write code** using the EXACT tool name from step 1:
   \`\`\`typescript
   execute_code({
     code: \`
       import { biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info } from './servers/biocontext_hub/biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info';

       // Direct top-level await - no function wrapping!
       const result = await biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info({
         gene_symbol: "TP53"
       });

       // Filter results to avoid context overflow
       console.log({
         id: result.primaryAccession,
         organism: result.organism?.scientificName,
         name: result.proteinDescription?.recommendedName?.fullName?.value
       });
     \`
   })
   \`\`\`

### ❌ Common Mistakes to AVOID

1. **Wrapping code in async functions**:
   \`\`\`typescript
   // ❌ WRONG - Returns undefined!
   async function processGene() {
     const result = await tool(...);
     console.log(result);
   }
   processGene(); // NOT AWAITED - outer code completes first!
   \`\`\`

2. **Not logging results**:
   \`\`\`typescript
   // ❌ WRONG
   const result = await tool(...);
   // Forgot console.log - returns undefined!

   // ✅ CORRECT
   const result = await tool(...);
   console.log(result);
   \`\`\`

3. **Logging huge JSON responses**:
   \`\`\`typescript
   // ❌ WRONG - Can exceed 100k+ tokens!
   console.log(JSON.stringify(result, null, 2));

   // ✅ CORRECT - Filter first
   console.log({ id: result.id, name: result.name });
   \`\`\`

4. **Guessing tool names instead of using read_tool_definition**:
   \`\`\`typescript
   // ❌ WRONG - Abbreviated name won't work!
   import { bc_get_protein } from './servers/biocontext_hub/bc_get_protein';

   // ✅ CORRECT - Use exact name from read_tool_definition
   import { biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info } from './servers/biocontext_hub/biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info';
   \`\`\`

### Code Execution Patterns (from Anthropic MCP Docs)

⚠️ **Always LOG results** - use \`console.log()\` or code returns \`undefined\`!

All examples below use **direct top-level await** (Anthropic's recommended pattern):

**Simple tool call**:
\`\`\`typescript
const info = await tool({ param: 'value' });
console.log(info.name);
\`\`\`

**Multiple sequential calls**:
\`\`\`typescript
const data1 = await tool1({ param: 'value' });
const data2 = await tool2({ param: data1.result });
console.log({ data1, data2 });
\`\`\`

**Loops and iteration**:
\`\`\`typescript
const genes = ['TP53', 'EGFR', 'BRCA1'];
for (const gene of genes) {
  const info = await getTool({ gene });
  console.log(\`\${gene}: \${info.name}\`);
}
\`\`\`

**Conditional logic**:
\`\`\`typescript
const result = await tool1({ param: 'value' });
if (result.status === 'pending') {
  const details = await tool2({ id: result.id });
  console.log('Pending:', details);
} else {
  console.log('Complete:', result);
}
\`\`\`

**Polling pattern** (from Anthropic docs):
\`\`\`typescript
let found = false;
while (!found) {
  const messages = await getMessages({ channel: 'C123' });
  found = messages.some(m => m.text.includes('complete'));
  if (!found) await new Promise(r => setTimeout(r, 5000));
}
console.log('Found the message!');
\`\`\`

**Error handling**:
\`\`\`typescript
try {
  const data = await tool({ param: 'value' });
  console.log('Success:', data);
} catch (error) {
  console.error('Failed:', error.message);
}
\`\`\`

**Data filtering** (context efficiency - from Anthropic docs):
\`\`\`typescript
const allRows = await getSheet({ sheetId: 'abc123' });
const filtered = allRows.filter(row => row.status === 'pending');
console.log(\`Found \${filtered.length} pending items\`);
console.log(filtered.slice(0, 5)); // Only log first 5
\`\`\`

### Server Discovery Workflow

⚠️ **ALWAYS discover servers first** - don't guess server names or tool names!

\`\`\`typescript
// Step 1: List available servers
list_servers()

// Step 2: Read tool definition to get EXACT tool name and parameters
read_tool_definition({
  server_name: "biocontext_hub",
  tool_name: "biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info"
})

// Step 3: Execute code with EXACT tool name from step 2
execute_code({
  code: \`
    import { biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info } from './servers/biocontext_hub/biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info';

    // Direct top-level await - no function wrapping
    const result = await biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info({
      gene_symbol: "TP53"
    });

    console.log({
      id: result.primaryAccession,
      name: result.proteinDescription?.recommendedName?.fullName?.value
    });
  \`
})
\`\`\`

### Data Filtering (CRITICAL for Large Results)

MCP tools may return massive JSON objects (100k+ characters). You MUST filter data in code:

\`\`\`typescript
const result = await tool({ param: 'value' });

// Extract only what you need for the user's question
const summary = {
  id: result.primaryAccession,
  organism: result.organism?.scientificName,
  name: result.proteinDescription?.recommendedName?.fullName?.value
  // Add only fields relevant to user's query
};

console.log(summary); // Clean, filtered output
\`\`\`

### Technical Notes

- All code runs in a secure sandbox (5 second timeout, 512MB memory limit)
- **Write code with direct top-level await** - DO NOT wrap in async functions
- Use static imports: \`import { X } from './servers/Y/X'\`
- **MUST use console.log()** - only logged data returns to you
- Import paths are relative: \`./servers/{server_name}/{tool_name}\`
- Check JSDoc comments in tool definitions for parameter details
`;

        // Build system prompt first (needed for token calculation)
        const systemPrompt = `${promptsContext ? promptsContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}${contextPrompt ? contextPrompt + '\n\n' + '='.repeat(80) + '\n\n' : ''}${SYSTEM_PROMPT}

${codeEnvDocs}

${'='.repeat(80)}

CRITICAL INSTRUCTION: You MUST follow this workflow:
1. Write code to call tools and get data
2. Execute the code and wait for results
3. Analyze the results
4. Provide a complete answer to the user

NEVER stop after just executing code. Always explain what you learned from the results.

**MCP Resources & Prompts:**
- Use mcp__list_resources to discover available data sources (schemas, metadata, documents)
- Use mcp__read_resource to access resource content when needed
- Use mcp__list_prompts to see available analysis templates
- Use mcp__get_prompt to retrieve specific analysis workflows

${contextPrompt ? '\n\nREMINDER: Check the "Session Data Context" section above BEFORE calling any tools!' : ''}`;

        // Check if summarization is needed
        const needsSummarization = shouldSummarize(systemPrompt, messages, tools);

        let processedMessages = messages;

        if (needsSummarization) {
          const { summaryText, recentMessages, summarizedCount } = await summarizeOlderMessages(messages);

          // Create synthetic summary message and prepend to recent messages
          const summaryMessage = createSummaryMessage(summaryText);
          processedMessages = [summaryMessage, ...recentMessages];
        }

        // Calculate final context size
        const finalContextSize = calculateContextSize(systemPrompt, processedMessages, tools);

        // Convert processed messages to model format
        const modelMessages = convertToModelMessages(processedMessages);

        // Add system prompt as first message with cache control
        // Then add cache control to last message to cache conversation history (including tool results)
        const messagesWithCaching = [
          {
            role: 'system' as const,
            content: systemPrompt,
            providerOptions: {
              anthropic: { cacheControl: { type: 'ephemeral' as const } }
            }
          },
          ...modelMessages
        ];

        // Add cache control to the last message to cache entire conversation (including tool results)
        if (messagesWithCaching.length > 1) {
          const lastMessage = messagesWithCaching[messagesWithCaching.length - 1];
          lastMessage.providerOptions = {
            anthropic: { cacheControl: { type: 'ephemeral' as const } }
          };
        }


        console.log('[Streaming] 🚀 Starting AI stream with model:', activeModelId);
        console.log('[Streaming] 📝 Context:', {
          messagesCount: messagesWithCaching.length,
          toolsCount: Object.keys(tools).length,
          hasCaching: true
        });

        const streamStartTime = Date.now();

        const result = streamText({
          model, // Use dynamically selected model
          messages: messagesWithCaching,
          tools,
          stopWhen: stepCountIs(25),

          onFinish: async ({ usage }) => {
            const streamDuration = Date.now() - streamStartTime;
            console.log(`[Streaming] ✅ Stream completed in ${streamDuration}ms`, {
              usage: usage || 'not available'
            });
          },

          // Track steps and extract plans
          onStepFinish: async (step) => {
            stepCount++;
            console.log(`[Streaming] 📊 Step ${stepCount} finished:`, {
              hasText: !!step.text,
              textLength: step.text?.length || 0,
              hasToolCalls: !!step.toolCalls,
              toolCallsCount: step.toolCalls?.length || 0,
              toolNames: step.toolCalls?.map(tc => tc.toolName) || []
            });

            // Extract and cache plans from reasoning text
            if (step.text) {
              const planText = extractPlanFromText(step.text);
              if (planText) {
                // Get user query from last message
                const userQuery = processedMessages.length > 0
                  ? (processedMessages[processedMessages.length - 1] as any).content || ''
                  : '';

                // Get tools used in this step
                const toolsUsed = step.toolCalls?.map(tc => tc.toolName) || [];

                // Create and save plan
                const plan = createPlanFromStep(
                  'current-session', // TODO: Get actual session ID
                  planText,
                  toolsUsed,
                  userQuery
                );

                savePlan(plan);
              }
            }
          },
        });

        // Merge the streamText result into the UI message stream
        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });

  } catch (error: any) {
    console.error('\n[ERROR]:', error.message);
    console.error('[STACK]:', error.stack);

    return new Response(JSON.stringify({
      error: error.message || "An error occurred"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
