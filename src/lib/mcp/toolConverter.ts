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

      console.log(
        `[ToolConverter] Found ${mcpTools.length} tools from server: ${serverName}`
      );

      for (const mcpTool of mcpTools) {
        // Create namespaced tool name to avoid conflicts between servers
        const toolName = `${serverName}__${mcpTool.name}`;

        // For Sleepyrat tools: Remove 'token' parameter from schema since auth is via headers
        // Per MCP spec, authentication MUST be via Authorization header, not tool parameters
        let schema = mcpTool.inputSchema;

        console.log(`[ToolConverter/DEBUG] Processing tool: ${toolName}`);
        console.log(`[ToolConverter/DEBUG] Original schema:`, JSON.stringify(schema));

        // Fix object-type properties that don't have additionalProperties defined
        // Anthropic API requires explicit additionalProperties for object types
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties)) {
            const propSchema = prop as any;
            if (propSchema.type === 'object' && !propSchema.properties && !propSchema.additionalProperties) {
              console.log(`[ToolConverter/DEBUG] Adding additionalProperties to ${key}`);
              propSchema.additionalProperties = true;
            }
          }
        }

        if (serverName === 'sleepyrat' && schema.properties?.token) {
          console.log(`[ToolConverter] ⚠️  Removing token parameter from ${toolName} schema`);

          const filteredProperties = Object.fromEntries(
            Object.entries(schema.properties).filter(([key]) => key !== 'token')
          );
          const filteredRequired = (schema.required || []).filter((key: string) => key !== 'token');

          console.log(`[ToolConverter/DEBUG] Filtered properties:`, Object.keys(filteredProperties));
          console.log(`[ToolConverter/DEBUG] Filtered required:`, filteredRequired);

          // Reconstruct schema without token parameter
          const hasProperties = Object.keys(filteredProperties).length > 0;

          if (hasProperties) {
            // Schema with properties - also fix object-type params here
            const fixedProperties = { ...filteredProperties };
            for (const [key, prop] of Object.entries(fixedProperties)) {
              const propSchema = prop as any;
              if (propSchema.type === 'object' && !propSchema.properties && !propSchema.additionalProperties) {
                console.log(`[ToolConverter/DEBUG] ⚠️  FIXING object-type property: ${key} (adding additionalProperties: true)`);
                propSchema.additionalProperties = true;
              }
            }

            schema = {
              type: 'object',
              properties: fixedProperties,
              ...(filteredRequired.length > 0 && { required: filteredRequired })
            };
            console.log(`[ToolConverter/DEBUG] ✅ Created schema WITH properties for ${toolName}`);

            // CRITICAL DEBUG: Log the EXACT final schema for run_python_code
            if (mcpTool.name === 'run_python_code') {
              console.log(`[ToolConverter/CRITICAL] 🔍 run_python_code FINAL SCHEMA:`, JSON.stringify(schema, null, 2));
            }
          } else {
            // For tools with no parameters, use the simplest valid schema
            schema = {
              type: 'object'
            };
            console.log(`[ToolConverter/DEBUG] ✅ Created schema WITHOUT properties (empty object)`);
          }

          console.log(`[ToolConverter/DEBUG] Final schema:`, JSON.stringify(schema));
        }

        // Wrap schema with jsonSchema() helper
        const wrappedSchema = jsonSchema(schema as any);
        console.log(`[ToolConverter/DEBUG] After jsonSchema() wrapper:`, JSON.stringify(wrappedSchema));

        tools[toolName] = {
          description: mcpTool.description || `Tool ${mcpTool.name} from ${serverName}`,
          inputSchema: wrappedSchema,

          /**
           * Execute the MCP tool and return results
           * Converts MCP CallToolResult to string format expected by AI SDK
           */
          execute: async (args) => {
            try {
              console.log(`[ToolConverter/EXEC] 🚀 Executing ${toolName}`);
              console.log(`[ToolConverter/EXEC] Input args received:`, JSON.stringify(args));

              // Debug: Check if headers are configured for Sleepyrat
              if (serverName === 'sleepyrat') {
                const connector = session.connector as any;
                const hasAuthHeader = connector.headers?.Authorization ? 'YES' : 'NO';
                console.log(`[ToolConverter/EXEC] Sleepyrat auth header present: ${hasAuthHeader}`);
                if (hasAuthHeader === 'YES') {
                  const authHeaderPrefix = connector.headers.Authorization.substring(0, 30);
                  console.log(`[ToolConverter/EXEC] Auth header starts with: ${authHeaderPrefix}...`);
                }

                // For Sleepyrat: Extract token from Authorization header and inject as parameter
                // The API still expects the token parameter even though we send the header
                if (connector.headers?.Authorization) {
                  const token = connector.headers.Authorization.replace('Bearer ', '');
                  const argsBefore = JSON.stringify(args);
                  args = { ...args, token };
                  console.log(`[ToolConverter/EXEC] 💉 Injecting token parameter`);
                  console.log(`[ToolConverter/EXEC] Args before injection:`, argsBefore);
                  console.log(`[ToolConverter/EXEC] Args after injection:`, JSON.stringify(args));
                  console.log(`[ToolConverter/EXEC] Token length:`, token.length, 'chars');
                }
              }

              const result = await session.connector.callTool(mcpTool.name, args);

              // MCP returns { content: Array<TextContent | ImageContent | ...> }
              // Convert to string format for AI SDK
              const formattedResult = formatMCPResult(result);

              console.log(`[ToolConverter] ${toolName} completed successfully`);

              return formattedResult;
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error(`[ToolConverter] Error executing ${toolName}:`, errorMessage);

              // For Sleepyrat auth errors, provide more context
              if (serverName === 'sleepyrat' && errorMessage.includes('segments')) {
                console.error('[ToolConverter] JWT parsing error detected - token may be malformed or missing');
              }

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

  console.log(`[ToolConverter] Total tools converted: ${Object.keys(tools).length}`);

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
    console.warn(`[ToolConverter] Invalid namespaced tool name: ${namespacedTool}`);
    return null;
  }

  return {
    serverName: parts[0],
    toolName: parts[1],
  };
}
