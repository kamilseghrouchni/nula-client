import { UIMessage } from 'ai';

/**
 * Token count thresholds
 */
export const TOKEN_THRESHOLDS = {
  // Trigger summarization when context exceeds this
  SUMMARIZATION_TRIGGER: 30000,

  // Keep this many recent messages unsummarized
  KEEP_RECENT_MESSAGES: 5,

  // Rough estimate: 1 token ≈ 4 characters
  CHARS_PER_TOKEN: 4,
} as const;

/**
 * Estimate token count from text (rough approximation)
 * OpenAI/Anthropic tokens average ~4 chars per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_THRESHOLDS.CHARS_PER_TOKEN);
}

/**
 * Calculate tokens for a single message
 */
export function calculateMessageTokens(message: UIMessage): number {
  let totalChars = 0;

  // Add role
  totalChars += message.role.length;

  // Handle string content (legacy format)
  if (typeof (message as any).content === 'string') {
    totalChars += (message as any).content.length;
    return estimateTokens(String(totalChars));
  }

  // Handle parts-based messages
  if (message.parts) {
    for (const part of message.parts) {
      if ((part as any).type === 'text') {
        totalChars += ((part as any).text || '').length;
      } else if ((part as any).type === 'tool-call' || (part as any).type === 'dynamic-tool') {
        // Tool name + args
        totalChars += ((part as any).toolName || '').length;
        totalChars += JSON.stringify((part as any).args || {}).length;

        // Tool result
        if ((part as any).result) {
          totalChars += JSON.stringify((part as any).result).length;
        }
      }
    }
  }

  return estimateTokens(String(totalChars));
}

/**
 * Calculate total tokens for message array
 */
export function calculateTotalTokens(messages: UIMessage[]): number {
  return messages.reduce((total, message) => {
    return total + calculateMessageTokens(message);
  }, 0);
}

/**
 * Estimate tokens for system prompt
 */
export function estimateSystemPromptTokens(systemPrompt: string): number {
  return estimateTokens(systemPrompt);
}

/**
 * Estimate tokens for tools definition
 */
export function estimateToolsTokens(tools: any): number {
  const toolsJson = JSON.stringify(tools);
  return estimateTokens(toolsJson);
}

/**
 * Calculate complete context size (system + messages + tools)
 */
export interface ContextSize {
  systemPromptTokens: number;
  messagesTokens: number;
  toolsTokens: number;
  totalTokens: number;
  exceedsThreshold: boolean;
}

export function calculateContextSize(
  systemPrompt: string,
  messages: UIMessage[],
  tools: any
): ContextSize {
  const systemPromptTokens = estimateSystemPromptTokens(systemPrompt);
  const messagesTokens = calculateTotalTokens(messages);
  const toolsTokens = estimateToolsTokens(tools);
  const totalTokens = systemPromptTokens + messagesTokens + toolsTokens;

  return {
    systemPromptTokens,
    messagesTokens,
    toolsTokens,
    totalTokens,
    exceedsThreshold: totalTokens > TOKEN_THRESHOLDS.SUMMARIZATION_TRIGGER,
  };
}

/**
 * Determine if summarization should be triggered
 */
export function shouldSummarize(
  systemPrompt: string,
  messages: UIMessage[],
  tools: any
): boolean {
  const contextSize = calculateContextSize(systemPrompt, messages, tools);
  return contextSize.exceedsThreshold;
}
