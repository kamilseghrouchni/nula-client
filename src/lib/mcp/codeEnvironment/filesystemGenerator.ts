/**
 * Virtual Filesystem Generator for MCP Tools
 *
 * Transforms MCP tool schemas into a virtual filesystem of TypeScript modules.
 * Each tool becomes an importable function with proper type definitions.
 *
 * This enables progressive disclosure: Claude can explore the filesystem and
 * load only the tool definitions it needs, rather than loading all 250-350
 * tool definitions upfront (which consumes 235k+ tokens).
 */

import type { Tool } from '@ai-sdk/provider-utils';
import type { MCPSession } from 'mcp-use';
import type { VirtualFilesystem } from './virtualFilesystem';

/**
 * Generate virtual filesystem from MCP sessions
 *
 * Creates a filesystem structure like:
 * /workspace/
 *   servers/
 *     biocontext_hub/
 *       index.ts
 *       bc_get_uniprot_protein_info.ts
 *       search_diseases.ts
 *     sleepyrat/
 *       index.ts
 *       analyze.ts
 *   client.ts
 */
export function generateVirtualFilesystem(
  sessions: Record<string, MCPSession>
): VirtualFilesystem {
  const files: Record<string, string> = {};

  // Generate client.ts (MCP bridge)
  files['/workspace/client.ts'] = generateClientBridge();

  // Generate tool files for each server
  const serverNames: string[] = [];

  for (const [serverName, session] of Object.entries(sessions)) {
    const toolFiles = generateServerTools(serverName, session);

    for (const [path, content] of Object.entries(toolFiles)) {
      files[path] = content;
    }

    serverNames.push(serverName);
  }

  // Generate main index that re-exports all servers
  files['/workspace/index.ts'] = generateMainIndex(serverNames);

  return { files };
}

/**
 * Generate client.ts - the MCP bridge that tools will use
 */
function generateClientBridge(): string {
  return `/**
 * MCP Client Bridge
 *
 * This module provides the callMCPTool function that routes tool calls
 * to the appropriate MCP server. This is injected by the sandbox runtime.
 *
 * Note: This is a CommonJS module to avoid ES6 import/export issues in the sandbox.
 * The actual callMCPTool is provided by the sandbox context.
 */

// The callMCPTool function is injected by the sandbox
// This module doesn't need to export anything since callMCPTool is globally available
module.exports = {};
`;
}

/**
 * Generate all tool files for a single server
 */
function generateServerTools(
  serverName: string,
  session: MCPSession
): Record<string, string> {
  const files: Record<string, string> = {};
  const safeName = sanitizeServerName(serverName);

  const tools = session.connector.tools;
  const toolNames: string[] = [];

  for (const tool of tools) {
    const fullToolName = tool.name;
    const shortToolName = getShortToolName(fullToolName);
    const toolFile = generateToolFile(serverName, tool);

    const filePath = `/workspace/servers/${safeName}/${shortToolName}.ts`;
    files[filePath] = toolFile;
    toolNames.push(shortToolName);
  }

  // Generate index.ts that exports all tools
  files[`/workspace/servers/${safeName}/index.ts`] = generateServerIndex(toolNames);

  return files;
}

/**
 * Extract short tool name from full MCP tool name
 *
 * Examples:
 *   "biocontext_ai_knowledgebase_mcp_bc_get_uniprot_protein_info" → "bc_get_uniprot_protein_info"
 *   "sviatkh_flybase_mcp_server_get_flybase_gene_summary" → "get_flybase_gene_summary"
 *   "hub_health" → "hub_health" (no prefix)
 */
function getShortToolName(fullToolName: string): string {
  // Common MCP naming patterns to strip
  const prefixes = ['_mcp_', '_mcp_server_', '_server_'];

  for (const prefix of prefixes) {
    const parts = fullToolName.split(prefix);
    if (parts.length > 1) {
      // Return everything after the last occurrence of the prefix
      return parts[parts.length - 1];
    }
  }

  // No prefix found - return full name
  return fullToolName;
}

/**
 * Generate JSDoc parameter documentation from JSON schema
 */
function generateParamDocs(schema: any): string {
  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    return ' * @param {Object} input - Tool input parameters';
  }

  const lines = [' * @param {Object} input - Tool input parameters'];
  const required = schema.required || [];

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    const prop = propSchema as any;
    const isRequired = required.includes(propName);
    const tsType = jsonSchemaTypeToTS(prop);
    const description = prop.description || 'Parameter value';

    // Format: @param {type} [input.param] - description (for optional)
    //         @param {type} input.param - description (for required)
    if (isRequired) {
      lines.push(` * @param {${tsType}} input.${propName} - ${description}`);
    } else {
      lines.push(` * @param {${tsType}} [input.${propName}] - ${description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate TypeScript file for a single tool
 */
function generateToolFile(serverName: string, tool: any): string {
  const fullToolName = tool.name;
  const shortToolName = getShortToolName(fullToolName);
  const description = tool.description || `${shortToolName} from ${serverName}`;
  const inputSchema = tool.inputSchema || {};

  // Generate full namespaced tool name for MCP call
  const mcpToolName = `${serverName}__${fullToolName}`;

  // Generate JSDoc parameter documentation
  const paramDocs = generateParamDocs(inputSchema);

  // Generate pure JavaScript CommonJS module (no TypeScript, no ES6 modules)
  // Use SHORT name for function and export, but FULL name for MCP call
  return `/**
 * ${description}
 *
${paramDocs}
 * @returns {Promise<Object>} Tool execution result
 */
async function ${shortToolName}(input) {
  return callMCPTool('${mcpToolName}', input);
}

module.exports = { ${shortToolName} };
`;
}

/**
 * Generate TypeScript interface from JSON schema
 */
function generateInputInterface(interfaceName: string, schema: any): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return `export interface ${interfaceName} {}`;
  }

  const properties = schema.properties;
  const required = schema.required || [];

  const fields: string[] = [];

  for (const [propName, propSchema] of Object.entries(properties)) {
    const prop = propSchema as any;
    const isRequired = required.includes(propName);
    const optional = isRequired ? '' : '?';
    const tsType = jsonSchemaTypeToTS(prop);
    const comment = prop.description ? `  /** ${prop.description} */\n` : '';

    fields.push(`${comment}  ${propName}${optional}: ${tsType};`);
  }

  return `export interface ${interfaceName} {\n${fields.join('\n')}\n}`;
}

/**
 * Convert JSON Schema type to TypeScript type
 */
function jsonSchemaTypeToTS(schema: any): string {
  // Handle anyOf (union types)
  if (schema.anyOf) {
    const types = schema.anyOf.map((s: any) => jsonSchemaTypeToTS(s));
    return types.join(' | ');
  }

  // Handle arrays
  if (schema.type === 'array') {
    if (schema.items) {
      const itemType = jsonSchemaTypeToTS(schema.items);
      return `${itemType}[]`;
    }
    return 'any[]';
  }

  // Handle objects
  if (schema.type === 'object') {
    if (schema.additionalProperties) {
      return 'Record<string, any>';
    }
    return 'object';
  }

  // Handle primitives
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'any';
  }
}

/**
 * Generate index.ts for a server that exports all its tools
 */
function generateServerIndex(toolNames: string[]): string {
  const requires = toolNames.map(name => {
    return `const ${name}_module = require('./${name}');\nObject.assign(exports, ${name}_module);`;
  }).join('\n');

  return `/**
 * Server tools index
 * Re-exports all tools from this MCP server (CommonJS)
 */

${requires}
`;
}

/**
 * Generate main index.ts that provides access to all servers
 */
function generateMainIndex(serverNames: string[]): string {
  const requires = serverNames
    .map(name => {
      const safeName = sanitizeServerName(name);
      return `exports.${safeName} = require('./servers/${safeName}');`;
    })
    .join('\n');

  return `/**
 * MCP Tools Index
 * Provides access to all MCP servers (CommonJS)
 */

${requires}
`;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .split(/[_\-\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Sanitize server name for use as directory/module name
 */
function sanitizeServerName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}
