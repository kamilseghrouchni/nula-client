import type { MCPSession } from 'mcp-use';
import type { PromptFetchPart } from '@/lib/types';

/**
 * Prompt metadata from MCP server
 */
export interface PromptMetadata {
  serverName: string;
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Result from listing prompts across all MCP servers
 */
export interface PromptListResult {
  prompts: PromptMetadata[];
  totalCount: number;
}

/**
 * List all available prompts from all MCP servers
 *
 * @param sessions Record of server names to MCPSession instances
 * @returns List of available prompts with server information
 */
export async function listAllPrompts(
  sessions: Record<string, MCPSession>
): Promise<PromptListResult> {
  const allPrompts: PromptMetadata[] = [];

  for (const [serverName, session] of Object.entries(sessions)) {
    try {
      console.log(`[PromptManager] Listing prompts from server: ${serverName}`);

      // List prompts from this server
      const result = await session.connector.listPrompts();

      for (const prompt of result.prompts) {
        allPrompts.push({
          serverName,
          name: prompt.name,
          title: prompt.title,
          description: prompt.description,
          arguments: prompt.arguments
        });
      }

      console.log(`[PromptManager] Found ${result.prompts.length} prompts from ${serverName}`);
    } catch (error) {
      console.error(`[PromptManager] Failed to list prompts from ${serverName}:`, error);
      // Continue with other servers
    }
  }

  return {
    prompts: allPrompts,
    totalCount: allPrompts.length
  };
}

/**
 * Get a specific prompt from an MCP server with arguments
 *
 * @param session MCP session for the server
 * @param promptName Name of the prompt
 * @param args Arguments to pass to the prompt
 * @returns Prompt messages
 */
export async function getPrompt(
  session: MCPSession,
  promptName: string,
  args: Record<string, any> = {}
): Promise<{
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}> {
  console.log(`[PromptManager] Getting prompt: ${promptName} with args:`, args);

  const result = await session.connector.getPrompt(promptName, args);

  // Convert MCP prompt messages to our format
  const messages = result.messages.map((msg: any) => ({
    role: msg.role as 'user' | 'assistant',
    content: typeof msg.content === 'string'
      ? msg.content
      : msg.content.text || JSON.stringify(msg.content)
  }));

  return {
    description: result.description,
    messages
  };
}

/**
 * Create a prompt-fetch message part
 *
 * @param serverName Name of the MCP server
 * @param promptName Name of the prompt
 * @param args Arguments passed to the prompt
 * @param status Fetch status
 * @param prompt Optional prompt data (if fetched)
 * @param error Optional error message
 * @returns PromptFetchPart
 */
export function createPromptFetchPart(
  serverName: string,
  promptName: string,
  args: Record<string, any>,
  status: 'fetching' | 'complete' | 'error',
  prompt?: {
    description?: string;
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>;
  },
  error?: string
): PromptFetchPart {
  const part: PromptFetchPart = {
    type: 'prompt-fetch',
    serverName,
    promptName,
    args,
    status
  };

  if (status === 'complete' && prompt) {
    part.prompt = prompt;
  }

  if (status === 'error' && error) {
    part.error = error;
  }

  return part;
}

/**
 * Fetch a prompt and create message parts for visibility
 *
 * @param session MCP session for the server
 * @param serverName Name of the MCP server
 * @param promptName Name of the prompt
 * @param args Arguments to pass to the prompt
 * @returns Array of PromptFetchPart message parts
 */
export async function fetchPromptWithVisibility(
  session: MCPSession,
  serverName: string,
  promptName: string,
  args: Record<string, any> = {}
): Promise<PromptFetchPart[]> {
  const parts: PromptFetchPart[] = [];

  try {
    // Create fetching part
    const fetchingPart = createPromptFetchPart(
      serverName,
      promptName,
      args,
      'fetching'
    );
    parts.push(fetchingPart);

    // Fetch prompt
    const prompt = await getPrompt(session, promptName, args);

    // Create complete part
    const completePart = createPromptFetchPart(
      serverName,
      promptName,
      args,
      'complete',
      prompt
    );
    parts.push(completePart);

    console.log(`[PromptManager] ✅ Fetched prompt: ${promptName}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[PromptManager] ❌ Failed to fetch prompt ${promptName}:`, errorMessage);

    // Create error part
    const errorPart = createPromptFetchPart(
      serverName,
      promptName,
      args,
      'error',
      undefined,
      errorMessage
    );
    parts.push(errorPart);
  }

  return parts;
}

/**
 * Format available prompts for display to user or injection into system prompt
 *
 * @param prompts Array of prompt metadata
 * @returns Formatted string
 */
export function formatPromptsForDisplay(prompts: PromptMetadata[]): string {
  if (prompts.length === 0) return '';

  const sections = prompts.map(prompt => {
    const args = prompt.arguments?.length
      ? `\nArguments: ${prompt.arguments.map(a => `${a.name}${a.required ? '*' : ''}`).join(', ')}`
      : '';

    return `- **${prompt.name}** (${prompt.serverName})${prompt.description ? `\n  ${prompt.description}` : ''}${args}`;
  });

  return `## Available MCP Prompts

The following prompt templates are available from MCP servers:

${sections.join('\n')}

You can reference these prompts when needed.`;
}

/**
 * Substitute prompt content into conversation messages
 *
 * @param prompt Prompt with messages
 * @returns Formatted messages ready for injection
 */
export function formatPromptMessages(prompt: {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}): string {
  return prompt.messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
}
