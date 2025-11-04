import { MCPClient } from 'mcp-use';
import path from 'path';
import fs from 'fs';
import { fetchSleepyratToken } from './tokenFetcher';

/**
 * Singleton MCP client instance
 * Manages connections to multiple MCP servers defined in mcp-config.json
 */
let mcpClient: MCPClient | null = null;

/**
 * Get or create the singleton MCPClient instance
 * Loads configuration from mcp-config.json and establishes sessions with all servers
 *
 * For Sleepyrat: Dynamically fetches auth token and injects it into HTTP config
 *
 * @returns Promise resolving to the MCPClient instance
 * @throws Error if configuration file cannot be loaded or sessions fail to initialize
 */
export async function getMCPClient(): Promise<MCPClient> {
  if (mcpClient) {
    return mcpClient;
  }

  try {
    // Load config from project root
    const configPath = path.join(process.cwd(), 'mcp-config.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // If Sleepyrat server exists, inject runtime auth token
    if (config.mcpServers && config.mcpServers.sleepyrat) {
      console.log('[MCPClient] Fetching Sleepyrat authentication token...');

      try {
        const sleepyratToken = await fetchSleepyratToken();

        // Validate token format (should be a JWT with 3 parts separated by dots)
        const tokenParts = sleepyratToken.split('.');
        if (tokenParts.length !== 3) {
          throw new Error(`Invalid JWT format: expected 3 parts, got ${tokenParts.length}`);
        }

        // Log token info for debugging (first 20 chars only for security)
        console.log('[MCPClient] Token format validated:', {
          prefix: sleepyratToken.substring(0, 20) + '...',
          parts: tokenParts.length,
          totalLength: sleepyratToken.length
        });

        // Transform to HTTP config with runtime token
        config.mcpServers.sleepyrat = {
          url: 'https://sleepyrat.ai/api/mcp-tools',
          authToken: sleepyratToken,  // mcp-use converts to Authorization: Bearer header
          transport: 'http'
        };

        console.log('[MCPClient] Sleepyrat token injected successfully');
      } catch (tokenError) {
        console.error('[MCPClient] Failed to fetch/inject Sleepyrat token:', tokenError);
        // Remove sleepyrat from config if token fetch fails (graceful degradation)
        delete config.mcpServers.sleepyrat;
        console.warn('[MCPClient] Continuing without Sleepyrat server');
      }
    }

    // Create client from modified config
    mcpClient = MCPClient.fromDict(config);

    // Create sessions with all configured servers
    await mcpClient.createAllSessions();

    console.log('[MCPClient] Successfully initialized with all servers');

    return mcpClient;
  } catch (error) {
    console.error('[MCPClient] Failed to initialize:', error);
    mcpClient = null;
    throw new Error(`Failed to initialize MCP client: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Close all active MCP sessions and reset the singleton
 * Should be called during graceful shutdown or when resetting connections
 */
export async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    try {
      await mcpClient.closeAllSessions();
      console.log('[MCPClient] Successfully closed all sessions');
    } catch (error) {
      console.error('[MCPClient] Error closing sessions:', error);
    } finally {
      mcpClient = null;
    }
  }
}

/**
 * Get the current MCPClient instance without initializing
 * Useful for checking if client is already initialized
 *
 * @returns The MCPClient instance or null if not initialized
 */
export function getMCPClientInstance(): MCPClient | null {
  return mcpClient;
}
