import fs from 'fs';
import path from 'path';

// Stdio-based MCP server (runs as a subprocess)
export type StdioMCPServerConfig = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

// HTTP-based MCP server (connects via URL)
export type HttpMCPServerConfig = {
  url: string;
  headers?: Record<string, string>;
};

export type MCPServerConfig = StdioMCPServerConfig | HttpMCPServerConfig;

export type MCPConfig = {
  mcpServers: Record<string, MCPServerConfig>;
};

// Type guards
export function isStdioConfig(config: MCPServerConfig): config is StdioMCPServerConfig {
  return 'command' in config;
}

export function isHttpConfig(config: MCPServerConfig): config is HttpMCPServerConfig {
  return 'url' in config;
}

export function loadMCPConfig(): MCPConfig {
  const configPath = path.join(process.cwd(), 'mcp-config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('MCP configuration not found. Create mcp-config.json');
  }
  
  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent) as MCPConfig;
}

export function getFirstServerConfig(config: MCPConfig) {
  const [name, serverConfig] = Object.entries(config.mcpServers)[0];
  return { name, config: serverConfig };
}

export function getAllServerConfigs(config: MCPConfig) {
  return Object.entries(config.mcpServers).map(([name, serverConfig]) => ({
    name,
    config: serverConfig,
  }));
}