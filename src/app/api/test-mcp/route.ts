import { NextResponse } from 'next/server';
import { loadMCPConfig, getFirstServerConfig, isStdioConfig, isHttpConfig } from '@/lib/mcp/config';
import { resolveTokenPlaceholders } from '@/lib/mcp/tokenFetcher';
import { fetchSleepyratTools } from '@/lib/mcp/sleepyratAdapter';
import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('[1/5] Loading MCP configuration...');
    const config = loadMCPConfig();

    // Allow testing specific server via ?server=name query param
    const { searchParams } = new URL(request.url);
    const requestedServer = searchParams.get('server');

    let serverConfig;
    if (requestedServer) {
      const serverConfigData = config.mcpServers[requestedServer];
      if (!serverConfigData) {
        const availableServers = Object.keys(config.mcpServers).join(', ');
        throw new Error(`Server "${requestedServer}" not found. Available: ${availableServers}`);
      }
      serverConfig = { name: requestedServer, config: serverConfigData };
      logs.push(`[2/5] Testing requested server: ${serverConfig.name}`);
    } else {
      serverConfig = getFirstServerConfig(config);
      logs.push(`[2/5] Testing first server: ${serverConfig.name} (add ?server=name to test specific server)`);
    }

    if (isHttpConfig(serverConfig.config)) {
      logs.push(`[3/5] Server type: HTTP`);
      logs.push(`[3/5] URL: ${serverConfig.config.url}`);

      // Check if this is Sleepyrat (custom JSON API)
      if (serverConfig.name === 'sleepyrat') {
        logs.push('[4/5] Detected Sleepyrat - using custom JSON adapter');

        const apiResponse = await fetchSleepyratTools();
        const elapsed = Date.now() - startTime;

        logs.push(`[5/5] Connection successful! (${elapsed}ms)`);
        logs.push(`[Bonus] Server: ${apiResponse.server_info.name} v${apiResponse.server_info.version}`);
        logs.push(`[Bonus] Found ${apiResponse.tools.length} tools`);

        return NextResponse.json({
          success: true,
          serverName: serverConfig.name,
          serverType: 'HTTP (Sleepyrat JSON API)',
          url: serverConfig.config.url,
          connectionTime: elapsed,
          serverInfo: apiResponse.server_info,
          toolCount: apiResponse.tools.length,
          tools: apiResponse.tools.map(t => ({
            name: t.name,
            description: t.description,
            endpoint: t.endpoint,
            method: t.method,
          })),
          logs,
        });
      }

      // Otherwise try SSE transport for standard MCP servers
      logs.push('[4/5] Using SSE transport for standard MCP server');
      const resolvedHeaders = await resolveTokenPlaceholders(serverConfig.config.headers);
      logs.push('[4/5] Token resolved successfully');

      logs.push('[5/5] Creating MCP client connection...');
      const client = await createMCPClient({
        transport: new SSEClientTransport(
          new URL(serverConfig.config.url),
          resolvedHeaders
        ),
      });

      const elapsed = Date.now() - startTime;
      logs.push(`[5/5] Connection successful! (${elapsed}ms)`);

      logs.push('[Bonus] Fetching available tools...');
      const toolsResponse = await client.listTools();
      const toolsArray = Array.isArray(toolsResponse) ? toolsResponse : toolsResponse.tools || [];
      logs.push(`[Bonus] Found ${toolsArray.length} tools`);

      return NextResponse.json({
        success: true,
        serverName: serverConfig.name,
        serverType: 'HTTP (SSE)',
        url: serverConfig.config.url,
        connectionTime: elapsed,
        toolCount: toolsArray.length,
        tools: toolsArray.map(t => ({ name: t.name, description: t.description })),
        logs,
      });

    } else if (isStdioConfig(serverConfig.config)) {
      logs.push(`[3/5] Server type: STDIO`);
      logs.push(`[3/5] Command: ${serverConfig.config.command}`);

      logs.push('[4/5] Creating MCP client connection...');
      const client = await createMCPClient({
        transport: new StdioClientTransport({
          command: serverConfig.config.command,
          args: serverConfig.config.args,
          env: serverConfig.config.env,
        }),
      });

      const elapsed = Date.now() - startTime;
      logs.push(`[5/5] Connection successful! (${elapsed}ms)`);

      logs.push('[Bonus] Fetching available tools...');
      const toolsResponse = await client.listTools();
      const toolsArray = Array.isArray(toolsResponse) ? toolsResponse : toolsResponse.tools || [];
      logs.push(`[Bonus] Found ${toolsArray.length} tools`);

      return NextResponse.json({
        success: true,
        serverName: serverConfig.name,
        serverType: 'STDIO',
        command: serverConfig.config.command,
        connectionTime: elapsed,
        toolCount: toolsArray.length,
        tools: toolsArray.map(t => ({ name: t.name, description: t.description })),
        logs,
      });
    } else {
      throw new Error('Unknown server configuration type');
    }

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logs.push(`[ERROR] Connection failed: ${errorMessage}`);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorStack,
      connectionTime: elapsed,
      logs,
    }, { status: 500 });
  }
}
