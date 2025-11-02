/**
 * Multi-MCP Client Manager
 *
 * Manages multiple MCP server connections and merges their tools
 * into a single ToolSet for use with the AI SDK.
 */

import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { loadMCPConfig, getAllServerConfigs, isStdioConfig } from './config';
import { fetchSleepyratToken } from './tokenFetcher';
import type { CoreTool } from 'ai';

type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;
type ToolSet = Record<string, CoreTool>;

// Cache of all connected clients
let mcpClients: Map<string, MCPClient> | null = null;

/**
 * Get all MCP clients from config
 * Initializes connections on first call, returns cached clients afterwards
 */
export async function getAllMCPClients(): Promise<Map<string, MCPClient>> {
  if (mcpClients) {
    return mcpClients;
  }

  const config = loadMCPConfig();
  const serverConfigs = getAllServerConfigs(config);
  const clients = new Map<string, MCPClient>();

  console.log(`[MCP] Initializing ${serverConfigs.length} MCP servers...`);

  for (const { name, config: serverConfig } of serverConfigs) {
    try {
      console.log(`[MCP] Connecting to ${name}...`);

      let client: MCPClient;

      if (isStdioConfig(serverConfig)) {
        // Stdio transport for command-line MCP servers
        // Resolve ${SLEEPYRAT_TOKEN} in args if present
        const resolvedArgs = await Promise.all(
          serverConfig.args.map(async (arg) => {
            if (arg.includes('${SLEEPYRAT_TOKEN}')) {
              const token = await fetchSleepyratToken();
              return arg.replace('${SLEEPYRAT_TOKEN}', token);
            }
            return arg;
          })
        );

        client = await createMCPClient({
          transport: new StdioClientTransport({
            command: serverConfig.command,
            args: resolvedArgs,
            env: serverConfig.env,
          }),
        });
      } else {
        console.error(`[MCP] Unknown server type for ${name}`);
        continue;
      }

      clients.set(name, client);
      console.log(`[MCP] ✓ Connected to ${name}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(`[MCP] ✗ Failed to connect to ${name}:`);
      console.error(`[MCP]   Error: ${errorMessage}`);
      if (errorStack) {
        console.error(`[MCP]   Stack: ${errorStack}`);
      }
      // Continue with other servers (graceful degradation)
    }
  }

  mcpClients = clients;
  console.log(`[MCP] Successfully connected to ${clients.size} servers`);

  return clients;
}

/**
 * Get merged tools from all MCP servers
 * Tools are namespaced by server name to prevent conflicts
 */
export async function getAllTools(): Promise<ToolSet> {
  const clients = await getAllMCPClients();
  const allTools: ToolSet = {};

  // Get tools from all MCP clients
  for (const [serverName, client] of clients.entries()) {
    try {
      console.log(`[MCP] Fetching tools from ${serverName}...`);

      // Use client.tools() which returns a proper ToolSet with execute functions
      const serverToolSet = await client.tools();
      const totalToolCount = Object.keys(serverToolSet).length;
      let loadedCount = 0;

      // Add tools with namespace (skip authentication tools since they're pre-configured)
      for (const [toolName, tool] of Object.entries(serverToolSet)) {
        // Skip login/auth tools - authentication is handled via tokens
        if (toolName.toLowerCase().includes('login') || toolName.toLowerCase().includes('auth')) {
          console.log(`[MCP] ⊗ Skipping auth tool: ${serverName}__${toolName} (pre-authenticated)`);
          continue;
        }

        const namespacedName = `${serverName}__${toolName}`;
        allTools[namespacedName] = tool;
        loadedCount++;
      }

      console.log(`[MCP] ✓ Loaded ${loadedCount}/${totalToolCount} tools from ${serverName}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      console.error(`[MCP] ✗ Failed to fetch tools from ${serverName}:`);
      console.error(`[MCP]   Error: ${errorMessage}`);
      if (errorStack) {
        console.error(`[MCP]   Stack: ${errorStack}`);
      }
    }
  }

  const totalTools = Object.keys(allTools).length;
  console.log(`[MCP] Total tools available: ${totalTools}`);

  return allTools;
}

/**
 * Close all MCP client connections
 */
export async function closeAllClients(): Promise<void> {
  if (!mcpClients) return;

  console.log(`[MCP] Closing ${mcpClients.size} client connections...`);

  for (const [name, client] of mcpClients.entries()) {
    try {
      await client.close();
      console.log(`[MCP] ✓ Closed ${name}`);
    } catch (error) {
      console.error(`[MCP] ✗ Failed to close ${name}:`, error);
    }
  }

  mcpClients = null;
  console.log('[MCP] All clients closed');
}

/**
 * Get a specific MCP client by name
 */
export async function getMCPClient(serverName: string): Promise<MCPClient | undefined> {
  const clients = await getAllMCPClients();
  return clients.get(serverName);
}
