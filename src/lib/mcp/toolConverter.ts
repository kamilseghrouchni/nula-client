import { type Tool, jsonSchema } from '@ai-sdk/provider-utils';
import type { MCPSession } from 'mcp-use';

/**
 * Converts MCP tools from multiple servers to AI SDK CoreTool format
 * Handles tool namespacing and preserves metadata for phase detection
 *
 * @param sessions Record of server names to MCPSession instances
 * @returns Record of namespaced tool names to CoreTool definitions
 *
 * Tool naming convention: {serverName}__{originalToolName}
 * Example: "eda-mcp__load_dataset", "sleepyrat__analyze"
 */
export async function convertMCPToolsToAISDK(
  sessions: Record<string, MCPSession>
): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};

  for (const [serverName, session] of Object.entries(sessions)) {
    try {
      // Get all tools available from this MCP server's connector
      const mcpTools = session.connector.tools;

      // SECURITY: Filter out forbidden tools before making them available to AI
      const FORBIDDEN_PATTERNS = [
        /^run_/i,           // Tools starting with 'run_' (e.g., run_python_code, run_analysis)
        /_python$/i,        // Tools ending with '_python' (e.g., execute_python)
        /^plot_/i,          // Plotting tools (e.g., plot_data, plot_chart)
        /^create_chart/i,   // Chart creation tools
        /^visualize_/i,     // Visualization tools (e.g., visualize_data)
        /^generate_plot/i,  // Plot generation tools
      ];

      const filteredTools = mcpTools.filter((tool) => {
        const isForbidden = FORBIDDEN_PATTERNS.some((pattern) => pattern.test(tool.name));
        return !isForbidden;
      });

      for (const mcpTool of filteredTools) {
        // Create namespaced tool name to avoid conflicts between servers
        const toolName = `${serverName}__${mcpTool.name}`;

        // For Sleepyrat tools: Remove 'token' parameter from schema since auth is via headers
        // Per MCP spec, authentication MUST be via Authorization header, not tool parameters
        let schema = mcpTool.inputSchema;

        // Fix object-type properties that don't have additionalProperties defined
        // Anthropic API requires explicit additionalProperties for object types
        if (schema.properties) {
          // If properties object is empty, remove it entirely (Anthropic rejects empty properties)
          if (Object.keys(schema.properties).length === 0) {
            delete schema.properties;
          } else {
            // Fix nested object-type properties and array items
            for (const [key, prop] of Object.entries(schema.properties)) {
              const propSchema = prop as any;

              // Fix object-type parameters
              if (propSchema.type === 'object' && !propSchema.properties && !propSchema.additionalProperties) {
                propSchema.additionalProperties = true;
              }

              // Fix array-type parameters with empty items
              if (propSchema.type === 'array' && propSchema.items && Object.keys(propSchema.items).length === 0) {
                delete propSchema.items;
              }
            }
          }
        }

        if (serverName === 'sleepyrat' && schema.properties?.token) {
          const filteredProperties = Object.fromEntries(
            Object.entries(schema.properties).filter(([key]) => key !== 'token')
          );
          const filteredRequired = (schema.required || []).filter((key: string) => key !== 'token');

          // Reconstruct schema without token parameter
          const hasProperties = Object.keys(filteredProperties).length > 0;

          if (hasProperties) {
            // Schema with properties - also fix object-type params here
            const fixedProperties = { ...filteredProperties };
            for (const [key, prop] of Object.entries(fixedProperties)) {
              const propSchema = prop as any;
              if (propSchema.type === 'object' && !propSchema.properties && !propSchema.additionalProperties) {
                propSchema.additionalProperties = true;
              }
            }

            schema = {
              type: 'object',
              properties: fixedProperties,
              ...(filteredRequired.length > 0 && { required: filteredRequired })
            };
          } else {
            // For tools with no parameters, use the simplest valid schema
            schema = {
              type: 'object'
            };
          }
        }

        // FINAL FIX: Remove empty properties object if present (Anthropic API requirement)
        // This must be done AFTER all schema manipulations
        if (schema.properties && Object.keys(schema.properties).length === 0) {
          delete schema.properties;
        }

        // IMPORTANT: For tools with no parameters, DO NOT add additionalProperties
        // Anthropic API v5 works best with just { type: 'object' } for parameter-less tools
        // Adding additionalProperties: false can cause "Input should be a valid dictionary" errors
        // Keep schema as { type: 'object' } without additionalProperties

        // Wrap schema with jsonSchema() helper
        const wrappedSchema = jsonSchema(schema as any);

        tools[toolName] = {
          description: mcpTool.description || `Tool ${mcpTool.name} from ${serverName}`,
          inputSchema: wrappedSchema,

          /**
           * Execute the MCP tool and return results
           * Converts MCP CallToolResult to string format expected by AI SDK
           */
          execute: async (args) => {
            try {
              // TRANSFORM: Convert camelCase to snake_case for Python MCP servers
              // NOTE: With FastMCP proxy mounting (gateway.py refactor), backend servers
              // now expose their actual snake_case schemas. This transformation should
              // become a no-op as Claude will already use snake_case parameter names.
              // Keeping this as defensive programming for now.
              const transformedArgs = Object.fromEntries(
                Object.entries(args).map(([key, value]) => {
                  const snakeCase = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                  return [snakeCase, value];
                })
              );

              // For Sleepyrat: Extract token from Authorization header and inject as parameter
              // The API still expects the token parameter even though we send the header
              let finalArgs = transformedArgs;
              if (serverName === 'sleepyrat') {
                const connector = session.connector as any;
                if (connector.headers?.Authorization) {
                  const token = connector.headers.Authorization.replace('Bearer ', '');
                  finalArgs = { ...transformedArgs, token };
                }
              }

              const result = await session.connector.callTool(mcpTool.name, finalArgs);

              // MCP returns { content: Array<TextContent | ImageContent | ...> }
              // Convert to string format for AI SDK
              const formattedResult = formatMCPResult(result);

              return formattedResult;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`[ToolConverter] Error executing ${toolName}:`, errorMessage);

              // Return error as string so AI can see what went wrong
              return JSON.stringify({
                error: errorMessage,
                toolName: mcpTool.name,
                serverName,
              });
            }
          },
        };
      }
    } catch (error) {
      console.error(`[ToolConverter] Failed to load tools from ${serverName}:`, error);
      // Continue with other servers even if one fails
    }
  }

  return tools;
}

/**
 * Format MCP CallToolResult content into string format
 * Handles text, image, and resource content types
 *
 * @param result MCP tool execution result
 * @returns Formatted string representation
 */
function formatMCPResult(result: any): string {
  if (!result.content || !Array.isArray(result.content)) {
    return JSON.stringify(result);
  }

  // Process each content item
  const formattedContent = result.content.map((item: any) => {
    if (item.type === 'text') {
      return item.text;
    }

    if (item.type === 'image') {
      return `[Image: ${item.mimeType || 'unknown'}]`;
    }

    if (item.type === 'resource') {
      return `[Resource: ${item.resource?.uri || 'unknown'}]`;
    }

    // Fallback for unknown content types
    return JSON.stringify(item);
  });

  return formattedContent.join('\n');
}

/**
 * Extract server name and original tool name from namespaced tool
 *
 * @param namespacedTool Tool name in format "serverName__toolName"
 * @returns Object with serverName and toolName, or null if invalid format
 *
 * @example
 * parseToolName("eda-mcp__load_dataset")
 * // Returns: { serverName: "eda-mcp", toolName: "load_dataset" }
 */
export function parseToolName(namespacedTool: string): { serverName: string; toolName: string } | null {
  const parts = namespacedTool.split('__');

  if (parts.length !== 2) {
    return null;
  }

  return {
    serverName: parts[0],
    toolName: parts[1],
  };
}
