import { UIMessage } from 'ai';

export interface ToolCallSummary {
  toolName: string;
  args: Record<string, any>;
  result: any;
  messageId: string;
  messageIndex: number;
  timestamp?: number;
}

export interface ResourceFetchSummary {
  serverName: string;
  uri: string;
  name: string;
  messageId: string;
  messageIndex: number;
  timestamp?: number;
}

export interface PromptFetchSummary {
  serverName: string;
  promptName: string;
  args: Record<string, any>;
  messageId: string;
  messageIndex: number;
  timestamp?: number;
}

export interface DataContextSummary {
  toolCalls: ToolCallSummary[];
  resourceFetches: ResourceFetchSummary[];
  promptFetches: PromptFetchSummary[];
  loadedDatasets: string[];
  availableInformation: string[];
  lastUpdated: number;
}

/**
 * Analyzes message history to extract tool calls and their results
 * This helps the AI understand what data is already available in context
 */
export function buildDataContext(messages: UIMessage[]): DataContextSummary {
  const toolCalls: ToolCallSummary[] = [];
  const resourceFetches: ResourceFetchSummary[] = [];
  const promptFetches: PromptFetchSummary[] = [];
  const loadedDatasets = new Set<string>();
  const availableInfo = new Set<string>();

  messages.forEach((message, idx) => {
    // Only look at assistant messages that might contain tool calls, resources, or prompts
    if (message.role === 'assistant' && message.parts) {
      message.parts.forEach((part: any) => {
        // Check for tool calls (AI SDK v5 format - be permissive with types)
        const isToolCall = part.type === 'tool-call' ||
                          part.type === 'dynamic-tool' ||
                          part.type?.startsWith('tool-') ||
                          part.toolName; // Has toolName property

        if (isToolCall) {
          const toolName = part.toolName;
          const args = part.args || {};

          // Skip if toolName is undefined
          if (!toolName) {
            console.warn('[Context] Skipping tool call with undefined toolName', { part });
            return;
          }

          // Find the corresponding tool result
          const resultPart: any = message.parts?.find((p: any) =>
            p.type === 'tool-result' && p.toolCallId === part.toolCallId
          );

          const summary: ToolCallSummary = {
            toolName,
            args,
            result: resultPart?.result || null,
            messageId: message.id,
            messageIndex: idx,
          };

          toolCalls.push(summary);

          // Extract semantic information about what was loaded
          const datasetInfo = inferDatasetInfo(toolName, args, resultPart?.result);
          if (datasetInfo.dataset) {
            loadedDatasets.add(datasetInfo.dataset);
          }
          datasetInfo.information.forEach(info => availableInfo.add(info));
        }

        // Check for resource fetches
        if (part.type === 'resource-fetch' && part.status === 'complete') {
          const resourceSummary: ResourceFetchSummary = {
            serverName: part.serverName,
            uri: part.uri,
            name: part.resource?.name || part.uri.split('/').pop() || part.uri,
            messageId: message.id,
            messageIndex: idx,
          };
          resourceFetches.push(resourceSummary);

          // Track as available information
          availableInfo.add(`Resource: ${resourceSummary.name} from ${part.serverName}`);
        }

        // Check for prompt fetches
        if (part.type === 'prompt-fetch' && part.status === 'complete') {
          const promptSummary: PromptFetchSummary = {
            serverName: part.serverName,
            promptName: part.promptName,
            args: part.args || {},
            messageId: message.id,
            messageIndex: idx,
          };
          promptFetches.push(promptSummary);

          // Track as available information
          availableInfo.add(`Prompt: ${part.promptName} from ${part.serverName}`);
        }
      });
    }
  });

  return {
    toolCalls,
    resourceFetches,
    promptFetches,
    loadedDatasets: Array.from(loadedDatasets),
    availableInformation: Array.from(availableInfo),
    lastUpdated: Date.now(),
  };
}

/**
 * Infer what kind of data was loaded based on tool name and arguments
 * This helps track what datasets are available in the conversation
 */
function inferDatasetInfo(
  toolName: string,
  args: Record<string, any>,
  result: any
): { dataset: string | null; information: string[] } {
  const info: string[] = [];
  let dataset: string | null = null;

  // Safety check
  if (!toolName || typeof toolName !== 'string') {
    return { dataset, information: info };
  }

  // Common patterns for data-loading tools
  if (toolName.includes('load') || toolName.includes('get') || toolName.includes('read')) {
    // Try to infer dataset name
    if (toolName.includes('compound')) {
      dataset = 'Compound list';
      info.push('compound names, formulas, retention times');
    } else if (toolName.includes('cv') || toolName.includes('coefficient')) {
      dataset = 'CV analysis results';
      info.push('CV values by extraction method');
      info.push('quality metrics (CV distribution, outliers)');
    } else if (toolName.includes('acquisition')) {
      dataset = 'Acquisition data';
      info.push('sample acquisition information');
    } else {
      // Generic data loading
      dataset = 'Dataset';
      info.push('analysis data');
    }

    // Check if result gives us more info
    if (result && typeof result === 'object') {
      if (result.rowCount || result.length) {
        const count = result.rowCount || result.length;
        dataset = dataset ? `${dataset} (${count} rows)` : `Dataset (${count} rows)`;
      }
    }
  }

  // Analysis tools
  if (toolName.includes('analyze') || toolName.includes('calculate')) {
    info.push(`${toolName} analysis results`);
  }

  return { dataset, information: info };
}

/**
 * Generate a concise context string to inject into the system prompt
 * Optimized for token reduction
 */
export function formatContextForPrompt(context: DataContextSummary): string {
  if (context.toolCalls.length === 0 && context.resourceFetches.length === 0 && context.promptFetches.length === 0) {
    return ''; // No context to add yet
  }

  const sections: string[] = [];

  sections.push('## Session Data Context\n');

  // Concise dataset list
  if (context.loadedDatasets.length > 0) {
    sections.push(`**Datasets:** ${context.loadedDatasets.join(', ')}`);
  }

  // MCP Resources fetched
  if (context.resourceFetches.length > 0) {
    const resourceList = context.resourceFetches
      .map(r => `${r.name} (${r.serverName})`)
      .slice(-3) // Most recent 3
      .join(', ');
    sections.push(`**Resources:** ${resourceList}`);
  }

  // MCP Prompts used
  if (context.promptFetches.length > 0) {
    const promptList = context.promptFetches
      .map(p => `${p.promptName} (${p.serverName})`)
      .slice(-3) // Most recent 3
      .join(', ');
    sections.push(`**Prompts:** ${promptList}`);
  }

  // Concise info list (limit to 3 most recent)
  if (context.availableInformation.length > 0) {
    const recentInfo = context.availableInformation.slice(-3);
    sections.push(`**Available Info:** ${recentInfo.join(', ')}`);
  }

  // Condensed instructions
  sections.push('\n⚠️ REUSE existing data. Only reload if user requests new/different data.\n');

  return sections.join('\n');
}

/**
 * Check if a tool call would be redundant based on context
 * Returns true if this exact tool call was already made
 */
export function isRedundantToolCall(
  toolName: string,
  args: Record<string, any>,
  context: DataContextSummary
): boolean {
  return context.toolCalls.some(call => {
    if (call.toolName !== toolName) return false;

    // Compare arguments (simple equality check)
    const argsMatch = JSON.stringify(call.args) === JSON.stringify(args);
    return argsMatch;
  });
}

/**
 * Get a previous tool result if it exists
 */
export function getCachedToolResult(
  toolName: string,
  args: Record<string, any>,
  context: DataContextSummary
): any | null {
  const match = context.toolCalls.find(call => {
    if (call.toolName !== toolName) return false;
    return JSON.stringify(call.args) === JSON.stringify(args);
  });

  return match?.result || null;
}
