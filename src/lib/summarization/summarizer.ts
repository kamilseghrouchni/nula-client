import { anthropic } from '@ai-sdk/anthropic';
import { generateText, UIMessage } from 'ai';
import { TOKEN_THRESHOLDS } from '../utils/tokenCounter';

export interface SummarizationResult {
  summaryText: string;
  recentMessages: UIMessage[];
  summarizedCount: number;
}

/**
 * Summarize older messages while keeping recent ones intact
 */
export async function summarizeOlderMessages(
  messages: UIMessage[],
  keepRecent: number = TOKEN_THRESHOLDS.KEEP_RECENT_MESSAGES
): Promise<SummarizationResult> {
  // If we have fewer messages than the threshold, no summarization needed
  if (messages.length <= keepRecent) {
    return {
      summaryText: '',
      recentMessages: messages,
      summarizedCount: 0,
    };
  }

  // Split into older (to summarize) and recent (keep as-is)
  const olderMessages = messages.slice(0, -keepRecent);
  const recentMessages = messages.slice(-keepRecent);

  // Build conversation text for summarization
  const conversationText = olderMessages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      let content = '';

      // Extract text content
      if (typeof (msg as any).content === 'string') {
        content = (msg as any).content;
      } else if (msg.parts) {
        const textParts = msg.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text || '')
          .join('\n');
        content = textParts;
      }

      // Extract tool calls
      if (msg.parts) {
        const toolParts = msg.parts.filter((p: any) =>
          p.type === 'tool-call' || p.type === 'dynamic-tool'
        );

        if (toolParts.length > 0) {
          const toolSummary = toolParts
            .map((tool: any) => `  - Called tool: ${tool.toolName || 'unknown'}`)
            .join('\n');
          content += `\n\n[Tool Calls]\n${toolSummary}`;
        }
      }

      return `${role}: ${content}`;
    })
    .join('\n\n---\n\n');

  // Call Claude to summarize
  try {
    const { text: summary } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      prompt: `Summarize the following conversation concisely. Focus on:
1. What data the user requested or loaded
2. What tools were called and their results
3. What visualizations were created
4. The user's current goal or intent

Keep the summary under 200 words. Be specific about data and operations.

Conversation:
${conversationText}

Summary:`,
    });

    return {
      summaryText: summary.trim(),
      recentMessages,
      summarizedCount: olderMessages.length,
    };
  } catch (error) {
    console.error('[Summarizer] Error:', error);

    // Fallback: return a basic summary
    const toolCalls = olderMessages
      .flatMap((msg) => msg.parts || [])
      .filter((part: any) => part.type === 'tool-call' || part.type === 'dynamic-tool')
      .map((part: any) => part.toolName || 'unknown');

    const fallbackSummary = `Previous conversation (${olderMessages.length} messages): User interacted with the assistant, calling tools including: ${[...new Set(toolCalls)].join(', ') || 'none'}.`;

    return {
      summaryText: fallbackSummary,
      recentMessages,
      summarizedCount: olderMessages.length,
    };
  }
}

/**
 * Convert summary into a synthetic user message
 * This allows us to inject the summary into the conversation naturally
 */
export function createSummaryMessage(summaryText: string): UIMessage {
  return {
    id: `summary-${Date.now()}`,
    role: 'user',
    parts: [
      {
        type: 'text',
        text: `[Conversation Summary - Previous Context]\n\n${summaryText}`,
      } as any,
    ],
  };
}
