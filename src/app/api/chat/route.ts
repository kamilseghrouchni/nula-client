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
    const mcpClient = await getMCPClient();
    const sessions = mcpClient.getAllActiveSessions();
    const tools = await convertMCPToolsToAISDK(sessions);

    // Add synthetic tools for MCP resources and prompts
    const syntheticTools = await createSyntheticTools(sessions);
    Object.assign(tools, syntheticTools);

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


        const result = streamText({
          model, // Use dynamically selected model
          messages: messagesWithCaching,
          tools,
          stopWhen: stepCountIs(25),

          onFinish: async ({ usage }) => {
            // Intentionally empty - usage tracking can be added here if needed
          },

          // Track steps and extract plans
          onStepFinish: async (step) => {
            stepCount++;

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
