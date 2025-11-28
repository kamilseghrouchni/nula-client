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
import { getCodeModeTools } from '@/lib/mcp/codeModeToolConverter';
import { listAllPrompts, formatPromptsForDisplay } from '@/lib/mcp/promptManager';
import { SYSTEM_PROMPT } from '@/lib/prompts/system';
import { buildDataContext, formatContextForPrompt } from '@/lib/context/dataContext';
import { shouldSummarize, calculateContextSize } from '@/lib/utils/tokenCounter';
import { summarizeOlderMessages, createSummaryMessage } from '@/lib/summarization/summarizer';
import { extractPlanFromText, createPlanFromStep, savePlan } from '@/lib/cache/planCache';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const { messages } = json as { messages: UIMessage[] };

    // Use Anthropic Claude Sonnet 4.5 (configurable via env)
    const modelId = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
    const model = anthropic(modelId);

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

    console.log('[MCP Initialization] 🛠️ Getting Code Mode tools...');
    const toolsStartTime = Date.now();
    const tools = await getCodeModeTools(mcpClient);
    const toolsConvertTime = Date.now() - toolsStartTime;
    console.log(`[MCP Initialization] ✅ Code Mode tools ready in ${toolsConvertTime}ms`);
    console.log(`[MCP Initialization] 🎉 TOTAL: ${Object.keys(tools).length} Code Mode tools available (execute_code, search_tools)`);

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

        // Build system prompt first (needed for token calculation)
        const systemPrompt = `${promptsContext ? promptsContext + '\n\n' + '='.repeat(80) + '\n\n' : ''}${contextPrompt ? contextPrompt + '\n\n' + '='.repeat(80) + '\n\n' : ''}${SYSTEM_PROMPT}

CRITICAL INSTRUCTION: You MUST follow this workflow:
1. Call tools to get data
2. Wait for tool results
3. Analyze the results
4. Provide a complete answer to the user

NEVER stop after just calling tools. Always explain what you learned from the tool results.

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


        // Get max steps from environment variable with validation
        const maxSteps = Math.min(
          Math.max(parseInt(process.env.MAX_AI_STEPS || '25', 10), 1),
          100
        );

        console.log('[Streaming] 🚀 Starting AI stream with model:', modelId);
        console.log('[Streaming] 📝 Context:', {
          messagesCount: messagesWithCaching.length,
          toolsCount: Object.keys(tools).length,
          hasCaching: true,
          maxSteps
        });

        const streamStartTime = Date.now();

        const result = streamText({
          model, // Use dynamically selected model
          messages: messagesWithCaching,
          tools,
          stopWhen: stepCountIs(maxSteps),

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
