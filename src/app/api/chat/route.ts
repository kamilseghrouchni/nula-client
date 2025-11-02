import { anthropic } from '@ai-sdk/anthropic';
import {
  streamText,
  convertToModelMessages,
  UIMessage,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai';
import { getAllTools } from '@/lib/mcp/multiClient';
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

    // Get tools from all MCP servers (cached after first call)
    const tools = await getAllTools();
    console.log('[MCP] Loaded tools from all servers:', Object.keys(tools).length);
    let stepCount = 0;

    // Build data context from message history
    const dataContext = buildDataContext(messages);
    const contextPrompt = formatContextForPrompt(dataContext);

    console.log('[Context] Tool calls in history:', dataContext.toolCalls.length);
    console.log('[Context] Loaded datasets:', dataContext.loadedDatasets);

    // Debug: Check if context is being built correctly
    if (messages.length > 1) {
      console.log('[Context] Sample message parts:', messages.slice(-2).map(m => ({
        role: m.role,
        partTypes: m.parts?.map((p: any) => p.type) || []
      })));
    }

    // Log context prompt if it exists
    if (contextPrompt) {
      console.log('[Context] Injecting context into prompt (length:', contextPrompt.length, 'chars)');
    } else {
      console.log('[Context] No context to inject (first message or no tools called yet)');
    }

    // Create UI message stream with tool call support
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {

        // Build system prompt first (needed for token calculation)
        const systemPrompt = `${contextPrompt ? contextPrompt + '\n\n' + '='.repeat(80) + '\n\n' : ''}${SYSTEM_PROMPT}

CRITICAL INSTRUCTION: You MUST follow this workflow:
1. Call tools to get data
2. Wait for tool results
3. Analyze the results
4. Provide a complete answer to the user

NEVER stop after just calling tools. Always explain what you learned from the tool results.

${contextPrompt ? '\n\nREMINDER: Check the "Session Data Context" section above BEFORE calling any tools!' : ''}`;

        // Check if summarization is needed
        const needsSummarization = shouldSummarize(systemPrompt, messages, tools);

        let processedMessages = messages;

        if (needsSummarization) {
          console.log('[Summarization] Token threshold exceeded, summarizing older messages...');

          const { summaryText, recentMessages, summarizedCount } = await summarizeOlderMessages(messages);

          console.log('[Summarization] Complete:', {
            summarizedCount,
            recentCount: recentMessages.length,
            summaryLength: summaryText.length,
          });

          // Create synthetic summary message and prepend to recent messages
          const summaryMessage = createSummaryMessage(summaryText);
          processedMessages = [summaryMessage, ...recentMessages];

          console.log(`[Summarization] Final message count: ${processedMessages.length} (was ${messages.length})`);
        } else {
          console.log('[Summarization] Not needed, context within limits');
        }

        // Calculate final context size
        const finalContextSize = calculateContextSize(systemPrompt, processedMessages, tools);
        console.log('[Token Management] Final context:', finalContextSize);

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
          model: anthropic('claude-haiku-4-5'),
          messages: messagesWithCaching,
          tools,
          stopWhen: stepCountIs(25),

          // Log cache performance
          onFinish: async ({ usage }) => {
            if (usage) {
              console.log('[Cache Performance]', {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              });

              // Log full usage object to see cache metrics (includes Anthropic-specific cache data)
              console.log('[Full Usage]', JSON.stringify(usage, null, 2));
            }
          },

          // Track steps and extract plans
          onStepFinish: async (step) => {
            stepCount++;
            console.log(`[Step ${stepCount}] ${step.finishReason}`, {
              toolCalls: step.toolCalls?.length || 0,
              toolResults: step.toolResults?.length || 0,
              hasText: !!step.text
            });

            // Extract and log workflow metadata from reasoning
            if (step.text) {
              const workflowMatch = step.text.match(/\[WORKFLOW:\s*type="(parallel|sequential)"(?:\s+phase="([^"]+)")?\]/i);
              if (workflowMatch) {
                console.log('[Workflow Metadata]', {
                  type: workflowMatch[1],
                  phase: workflowMatch[2] || 'unspecified',
                  stepNumber: stepCount,
                });
              }
            }

            // Log tool errors for debugging
            if (step.toolResults) {
              for (const result of step.toolResults) {
                if ((result as any).error || (result as any).isError) {
                  const failedToolCall = step.toolCalls?.find((tc: any) => tc.toolCallId === (result as any).toolCallId) as any;
                  console.error('[Tool Error]', {
                    toolCallId: (result as any).toolCallId,
                    toolName: failedToolCall?.toolName || 'unknown',
                    error: (result as any).error || 'Unknown error',
                    args: failedToolCall?.args || {}
                  });
                }
              }
            }

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
                console.log('[Plan Cache] Extracted and saved plan from step');
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
