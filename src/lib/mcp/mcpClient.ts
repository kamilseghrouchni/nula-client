import { MCPClient } from 'mcp-use';
import path from 'path';
import fs from 'fs';

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

    console.log('[MCPClient] Config loaded, checking for environment variables...');

    // Replace ALL environment variables BEFORE parsing (${VAR_NAME} → actual value)
    const replacedContent = configContent.replace(
      /\$\{(\w+)\}/g,
      (match, envVar) => {
        const value = process.env[envVar];
        if (value) {
          console.log(`[MCPClient] Replacing ${match} with environment variable (${value.substring(0, 20)}...)`);
          return value;
        } else {
          console.warn(`[MCPClient] Environment variable ${envVar} not found, leaving ${match} as-is`);
          return match;
        }
      }
    );

    // Parse config with replaced env vars
    const config = JSON.parse(replacedContent);

    console.log('[MCPClient] Configuration parsed:', {
      servers: Object.keys(config.mcpServers || {}),
      count: Object.keys(config.mcpServers || {}).length
    });

    // Create client from config
    mcpClient = MCPClient.fromDict(config);

    // Create sessions with all configured servers
    console.log('[MCPClient] Creating sessions with all servers...');
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
