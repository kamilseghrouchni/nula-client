import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { loadMCPConfig, getFirstServerConfig, isStdioConfig, isHttpConfig } from './config';
import { resolveTokenPlaceholders } from './tokenFetcher';

let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;

export async function getMCPClient() {
  if (mcpClient) {
    return mcpClient;
  }

  const config = loadMCPConfig();
  const serverConfig = getFirstServerConfig(config);

  console.log('[MCP] Connecting to:', serverConfig.name);

  // Create transport based on config type
  if (isStdioConfig(serverConfig.config)) {
    // Stdio transport for command-line MCP servers
    mcpClient = await createMCPClient({
      transport: new StdioClientTransport({
        command: serverConfig.config.command,
        args: serverConfig.config.args,
        env: serverConfig.config.env,
      }),
    });
  } else if (isHttpConfig(serverConfig.config)) {
    // HTTP/SSE transport for URL-based MCP servers
    // Resolve token placeholders in headers
    const resolvedHeaders = await resolveTokenPlaceholders(serverConfig.config.headers);

    mcpClient = await createMCPClient({
      transport: new SSEClientTransport(
        new URL(serverConfig.config.url),
        resolvedHeaders
      ),
    });
  } else {
    throw new Error(`Unsupported MCP server configuration for ${serverConfig.name}`);
  }

  console.log(`[MCP] Connected to ${serverConfig.name}`);

  return mcpClient;
}