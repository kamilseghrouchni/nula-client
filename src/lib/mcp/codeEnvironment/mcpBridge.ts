/**
 * MCP Bridge
 *
 * Provides the callMCPTool function that routes tool calls from sandboxed code
 * to the appropriate MCP session. This is the only way for sandboxed code to
 * interact with external systems.
 *
 * Security:
 * - Validates tool names before execution
 * - Routes through established MCP sessions only
 * - Returns results without exposing session internals
 */

import type { MCPSession } from 'mcp-use';
import type { MCPBridge } from '../sandbox/codeExecutor';

/**
 * Create MCP bridge for code execution sandbox
 *
 * @param sessions - Active MCP sessions
 * @returns Bridge object with callMCPTool function
 */
export function createMCPBridge(sessions: Record<string, MCPSession>): MCPBridge {
  return {
    callMCPTool: async (toolName: string, args: any) => {
      return await callMCPTool(toolName, args, sessions);
    },
  };
}

/**
 * Call an MCP tool by its full namespaced name
 *
 * @param toolName - Full tool name like "biocontext-hub__bc_get_uniprot_protein_info"
 * @param args - Tool arguments
 * @param sessions - Active MCP sessions
 * @returns Tool execution result
 */
async function callMCPTool(
  toolName: string,
  args: any,
  sessions: Record<string, MCPSession>
): Promise<any> {
  // Parse tool name to extract server and tool parts
  const parsed = parseToolName(toolName);

  if (!parsed) {
    throw new Error(`Invalid tool name format: ${toolName}. Expected format: "server__tool"`);
  }

  const { serverName, toolName: actualToolName } = parsed;

  // Find the MCP session for this server
  const session = findSession(serverName, sessions);

  if (!session) {
    throw new Error(`MCP server not found: ${serverName}. Available servers: ${Object.keys(sessions).join(', ')}`);
  }

  // Find the tool in the session
  const tool = session.connector.tools.find(t => t.name === actualToolName);

  if (!tool) {
    const availableTools = session.connector.tools.map(t => t.name).join(', ');
    throw new Error(`Tool not found: ${actualToolName} in server ${serverName}. Available tools: ${availableTools}`);
  }

  try {
    // Call the tool through the MCP connector
    const result = await session.connector.callTool(actualToolName, args);

    // Format and return the result
    return formatMCPResult(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`MCP tool execution failed for ${toolName}: ${errorMessage}`);
  }
}

/**
 * Parse namespaced tool name into server and tool parts
 *
 * @param namespacedTool - Tool name like "biocontext-hub__bc_get_uniprot_protein_info"
 * @returns Parsed server name and tool name
 */
function parseToolName(namespacedTool: string): { serverName: string; toolName: string } | null {
  const parts = namespacedTool.split('__');

  if (parts.length !== 2) {
    return null;
  }

  return {
    serverName: parts[0],
    toolName: parts[1],
  };
}

/**
 * Find MCP session by server name (handles name variations)
 *
 * Tries both exact match and sanitized versions since server names may be
 * sanitized differently in different parts of the system.
 */
function findSession(
  serverName: string,
  sessions: Record<string, MCPSession>
): MCPSession | null {
  // Try exact match first
  if (sessions[serverName]) {
    return sessions[serverName];
  }

  // Try with underscores converted to hyphens
  const withHyphens = serverName.replace(/_/g, '-');
  if (sessions[withHyphens]) {
    return sessions[withHyphens];
  }

  // Try case-insensitive match
  const lowerServerName = serverName.toLowerCase();
  for (const [name, session] of Object.entries(sessions)) {
    if (name.toLowerCase() === lowerServerName) {
      return session;
    }
  }

  return null;
}

/**
 * Format MCP tool result for consumption by sandbox code
 *
 * MCP returns results in a structured format with content array.
 * This extracts the relevant data and returns it in a clean format.
 */
function formatMCPResult(result: any): any {
  if (!result) {
    return null;
  }

  // If result has content array, extract text content
  if (result.content && Array.isArray(result.content)) {
    const textContent = result.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('\n');

    // Try to parse as JSON if it looks like JSON
    if (textContent.trim().startsWith('{') || textContent.trim().startsWith('[')) {
      try {
        return JSON.parse(textContent);
      } catch {
        // Not valid JSON, return as string
        return textContent;
      }
    }

    return textContent;
  }

  // Return result as-is if it's already in a simple format
  return result;
}
