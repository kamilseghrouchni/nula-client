import { type Tool, jsonSchema } from '@ai-sdk/provider-utils';
import type { MCPClient } from 'mcp-use';
import vm from 'node:vm';

/**
 * Format parameters from JSON schema as compact string for description
 * Example: "gene_id_or_symbol (string, required), species (string, optional)"
 *
 * @param schema - JSON Schema object
 * @returns Compact parameter string for embedding in descriptions
 */
function formatParametersForDescription(schema: any): string {
  if (!schema?.properties) return '';

  const properties = schema.properties;
  const required = schema.required || [];

  const params = Object.entries(properties).map(([name, propSchema]: [string, any]) => {
    const type = propSchema.type || 'any';
    const isRequired = required.includes(name);
    return `${name} (${type}, ${isRequired ? 'required' : 'optional'})`;
  });

  return params.length > 0 ? `Params: ${params.join(', ')}` : '';
}

/**
 * Extract human-readable parameter information from JSON schema
 *
 * @param schema - JSON Schema object
 * @returns Array of parameter info objects
 */
function extractParameterInfo(schema: any): any[] {
  const params: any[] = [];
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [paramName, paramSchema] of Object.entries(properties)) {
    const param: any = {
      name: paramName,
      type: (paramSchema as any).type || 'unknown',
      required: required.includes(paramName)
    };

    if ((paramSchema as any).description) {
      param.description = (paramSchema as any).description;
    }

    params.push(param);
  }

  return params;
}

/**
 * Enhance Pydantic validation errors with schema information
 *
 * @param error - Error object from tool execution
 * @param toolName - Name of the tool that failed
 * @param inputSchema - Tool's input schema
 * @returns Enhanced error message with parameter guidance
 */
function enhanceValidationError(
  error: Error,
  toolName: string,
  inputSchema: any
): string {
  const errorMessage = error.message;

  // Detect Pydantic validation errors
  if (errorMessage.includes('validation error') && errorMessage.includes('Field required')) {
    // Extract missing field name
    const fieldMatch = errorMessage.match(/(\w+)\s+Field required/);
    if (fieldMatch && inputSchema?.properties) {
      const missingField = fieldMatch[1];
      const fieldInfo = inputSchema.properties[missingField];

      const params = extractParameterInfo(inputSchema);

      return `Tool '${toolName}' parameter error: missing required field '${missingField}'${
        fieldInfo?.description ? ` (${fieldInfo.description})` : ''
      }

Expected parameters:
${JSON.stringify(params, null, 2)}

Original error: ${errorMessage}`;
    }
  }

  // Return original error if we can't enhance it
  return errorMessage;
}

/**
 * Get Code Mode tools - custom implementation
 *
 * Provides two special tools:
 * 1. execute_code - Run JavaScript with access to MCP tools
 * 2. search_tools - Discover available tools dynamically
 *
 * Tools are accessed in code as: serverName.toolName(args)
 *
 * @param client MCPClient instance
 * @returns Code Mode tools for AI SDK
 */
export async function getCodeModeTools(client: MCPClient): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};

  // Only execute_code - search_tools will be available inside VM
  tools['execute_code'] = {
    description: `Execute JavaScript/TypeScript code with access to MCP tools.

**REQUIRED WORKFLOW:**
1. Call get_tool_schema(tool_name) BEFORE using any tool
2. Inspect both input_parameters AND output_parameters
3. Use correct parameters when calling the tool
4. Access response fields according to output_schema

Tools are available as functions using their exact names (e.g., genomoncology_biomcp_gene_getter).

**Example - Correct workflow:**
\`\`\`javascript
// 1. Inspect schema first
const schema = await get_tool_schema("genomoncology_biomcp_gene_getter");
console.log("Expects:", schema.input_parameters);   // [{name: "gene_id_or_symbol", type: "string", required: true}]
console.log("Returns:", schema.output_parameters);  // Shows actual response structure

// 2. Call with correct parameters
const result = await genomoncology_biomcp_gene_getter({
  gene_id_or_symbol: "BRCA1"
});

// 3. Access response according to output_schema
// Don't assume field names - use what the schema specifies!
console.log(result);
\`\`\`

**CRITICAL:** Never assume response structure (e.g., .results, .data, .items).
Always check output_schema to know the actual field names and structure.

Use search_tools(query, "full") to discover tools with complete schema information.

Use console.log() to return results.
Code runs in a sandboxed environment with 60-second timeout.`,
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to execute. MUST call get_tool_schema() before using any tool to understand input parameters AND output structure.'
        }
      },
      required: ['code'],
      additionalProperties: false
    }),
    execute: async ({ code }: { code: string }) => {
      return await executeCodeWithMCP(client, code);
    }
  };

  return tools;
}

/**
 * Execute code using VM with MCP tool access
 *
 * @param client MCPClient instance
 * @param code JavaScript code to execute
 * @returns Execution result with output and logs
 */
export async function executeCodeWithMCP(client: MCPClient, code: string) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    // Get all active sessions
    const sessions = client.getAllActiveSessions();

    // Create tool namespaces - FLAT structure using exact tool names
    const toolNamespaces: Record<string, Function> = {};

    for (const [serverName, session] of Object.entries(sessions)) {
      const tools = session.connector.tools;

      for (const tool of tools || []) {
        // Normalize tool name: replace hyphens with underscores for valid JS identifiers
        const normalizedToolName = tool.name.replace(/-/g, '_');

        // Create wrapper function with exact tool name
        toolNamespaces[normalizedToolName] = async (args: any) => {
          try {
            const result = await session.connector.callTool(tool.name, args || {});

            // Extract text content from result
            const textContent = result.content?.find((c: any) => c.type === 'text');
            if (textContent && textContent.text) {
              // Try to parse as JSON if possible
              try {
                return JSON.parse(String(textContent.text));
              } catch {
                return String(textContent.text);
              }
            }
            return result;
          } catch (error) {
            // Enhanced error with schema info
            const enhancedMessage = enhanceValidationError(
              error instanceof Error ? error : new Error(String(error)),
              normalizedToolName,
              tool.inputSchema
            );
            throw new Error(enhancedMessage);
          }
        };
      }
    }

    // Create console implementation that captures logs
    const consoleImpl = {
      log: (...args: any[]) => {
        logs.push(args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      error: (...args: any[]) => {
        logs.push('[ERROR] ' + args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      warn: (...args: any[]) => {
        logs.push('[WARN] ' + args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      },
      info: (...args: any[]) => {
        logs.push('[INFO] ' + args.map(arg =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' '));
      }
    };

    // Create search_tools function for VM context
    const search_tools = async (
      query?: string,
      detail_level?: 'names' | 'descriptions' | 'full'
    ) => {
      return await searchToolsWithMCP(client, query, detail_level || 'full');
    };

    // Create get_tool_schema helper for VM context
    const get_tool_schema = (toolName: string) => {
      // Normalize tool name for lookup
      const normalizedToolName = toolName.replace(/-/g, '_');

      // Find tool across all sessions
      for (const [sessionName, session] of Object.entries(sessions)) {
        const tools = session.connector.tools || [];

        for (const tool of tools) {
          if (tool.name.replace(/-/g, '_') === normalizedToolName) {
            return {
              name: normalizedToolName,
              description: tool.description || '',

              // Input schema
              input_parameters: tool.inputSchema ? extractParameterInfo(tool.inputSchema) : [],
              input_schema: tool.inputSchema || {},

              // Output schema
              output_parameters: tool.outputSchema ? extractParameterInfo(tool.outputSchema) : [],
              output_schema: tool.outputSchema || {}
            };
          }
        }
      }

      return null;
    };

    // Create VM context with tool namespaces, search_tools, get_tool_schema, and console
    const context = vm.createContext({
      ...toolNamespaces,
      search_tools,
      get_tool_schema,  // NEW: Runtime schema inspection
      console: consoleImpl,
      // Standard JavaScript built-ins
      Array, Object, String, Number, Boolean, Date, Math, JSON, RegExp, Map, Set, Promise,
      parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI, encodeURIComponent, decodeURIComponent,
      setTimeout, clearTimeout, setInterval, clearInterval,
      // Special info about available tool namespaces
      __tool_namespaces: Object.keys(toolNamespaces)
    });

    // Wrap code in async function to support top-level await
    const wrappedCode = `
      (async () => {
        ${code}
      })()
    `;

    // Execute code (note: vm.Script doesn't support timeout option in the constructor)
    // Instead, we use a separate timeout mechanism
    const script = new vm.Script(wrappedCode, {
      filename: 'code-mode-execution.js'
    });

    // Run with manual timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Code execution timeout (60 seconds)')), 60000);
    });

    const result = await Promise.race([
      script.runInContext(context),
      timeoutPromise
    ]);

    const executionTime = (Date.now() - startTime) / 1000;

    return {
      success: true,
      result: result,
      logs: logs.join('\n'),
      execution_time: executionTime
    };

  } catch (error) {
    const executionTime = (Date.now() - startTime) / 1000;
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      logs: logs.join('\n'),
      execution_time: executionTime
    };
  }
}

/**
 * Search tools across all MCP servers
 *
 * @param client MCPClient instance
 * @param query Search query (optional)
 * @param detailLevel Level of detail to return
 * @returns Search results with tool information
 */
export async function searchToolsWithMCP(
  client: MCPClient,
  query?: string,
  detailLevel?: 'names' | 'descriptions' | 'full'
) {
  try {
    // Get all active sessions
    const sessions = client.getAllActiveSessions();
    const allTools: any[] = [];

    // Collect tools from all servers
    for (const [serverName, session] of Object.entries(sessions)) {
      const tools = session.connector.tools;

      for (const tool of tools || []) {
        // Normalize tool name: replace hyphens with underscores for valid JS identifiers
        const normalizedToolName = tool.name.replace(/-/g, '_');

        // Filter by query if provided
        if (query) {
          const searchText = `${tool.name} ${tool.description || ''}`.toLowerCase();
          if (!searchText.includes(query.toLowerCase())) {
            continue;
          }
        }

        // Build result based on detail level
        const toolInfo: any = {
          name: normalizedToolName,  // Exact callable name
          original_name: tool.name   // Keep original for reference
        };

        if (detailLevel === 'descriptions' || detailLevel === 'full') {
          // CRITICAL: Augment description with parameter hints
          let description = tool.description || '';
          const paramHints = formatParametersForDescription(tool.inputSchema);

          if (paramHints) {
            description = description
              ? `${description}. ${paramHints}`
              : paramHints;
          }

          toolInfo.description = description;
        }

        if (detailLevel === 'full') {
          // Include full input schema
          toolInfo.input_schema = tool.inputSchema || {};

          // Include output schema if available
          if (tool.outputSchema) {
            toolInfo.output_schema = tool.outputSchema;

            // Add formatted output parameters for readability
            toolInfo.output_parameters = extractParameterInfo(tool.outputSchema);
          }
        }

        allTools.push(toolInfo);
      }
    }

    return {
      meta: {
        total_tools: allTools.length,
        namespaces: Object.keys(sessions).map(name => name.replace(/-/g, '_')),
        result_count: allTools.length
      },
      results: allTools
    };
  } catch (error) {
    throw new Error(`Tool search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
