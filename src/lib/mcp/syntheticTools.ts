import type { MCPSession } from 'mcp-use';
import type { Tool } from '@ai-sdk/provider-utils';
import { jsonSchema } from '@ai-sdk/provider-utils';
import { listAllResources, readResource } from './resourceManager';
import { listAllPrompts, getPrompt } from './promptManager';

/**
 * Create synthetic tools for accessing MCP resources and prompts
 * These tools allow the AI to dynamically discover and fetch resources/prompts
 *
 * @param sessions Record of server names to MCPSession instances
 * @returns Record of synthetic tool names to Tool definitions
 */
export async function createSyntheticTools(
  sessions: Record<string, MCPSession>
): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};

  // Tool 1: List available resources
  tools['mcp__list_resources'] = {
    description: 'List all available resources from MCP servers. Resources are data sources like files, documents, schemas, or metadata that can provide context for analysis.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Optional: Filter resources by server name (e.g., "sleepyrat", "eda-mcp")'
        }
      }
    }),
    execute: async (args: { serverName?: string }) => {
      console.log('[SyntheticTools] Executing mcp__list_resources');

      const sessionsToQuery = args.serverName
        ? { [args.serverName]: sessions[args.serverName] }
        : sessions;

      const result = await listAllResources(sessionsToQuery);

      return JSON.stringify({
        total: result.totalCount,
        resources: result.resources.map(r => ({
          server: r.serverName,
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType
        }))
      }, null, 2);
    }
  };

  // Tool 2: Read a specific resource
  tools['mcp__read_resource'] = {
    description: 'Read the content of a specific resource by URI. Use this to access detailed information from data sources.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Name of the MCP server hosting the resource'
        },
        uri: {
          type: 'string',
          description: 'URI of the resource to read'
        }
      },
      required: ['serverName', 'uri']
    }),
    execute: async (args: { serverName: string; uri: string }) => {
      console.log('[SyntheticTools] Executing mcp__read_resource:', args);

      const session = sessions[args.serverName];
      if (!session) {
        return JSON.stringify({
          error: `Server ${args.serverName} not found`
        });
      }

      try {
        const { content, mimeType } = await readResource(session, args.uri);

        return JSON.stringify({
          uri: args.uri,
          server: args.serverName,
          mimeType,
          content
        }, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          error: errorMessage,
          uri: args.uri
        });
      }
    }
  };

  // Tool 3: List available prompts
  tools['mcp__list_prompts'] = {
    description: 'List all available prompt templates from MCP servers. Prompts are reusable analysis templates or workflows.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Optional: Filter prompts by server name'
        }
      }
    }),
    execute: async (args: { serverName?: string }) => {
      console.log('[SyntheticTools] Executing mcp__list_prompts');

      const sessionsToQuery = args.serverName
        ? { [args.serverName]: sessions[args.serverName] }
        : sessions;

      const result = await listAllPrompts(sessionsToQuery);

      return JSON.stringify({
        total: result.totalCount,
        prompts: result.prompts.map(p => ({
          server: p.serverName,
          name: p.name,
          title: p.title,
          description: p.description,
          arguments: p.arguments
        }))
      }, null, 2);
    }
  };

  // Tool 4: Get a specific prompt
  tools['mcp__get_prompt'] = {
    description: 'Get a specific prompt template with arguments. This retrieves the prompt messages that can guide your analysis.',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Name of the MCP server hosting the prompt'
        },
        promptName: {
          type: 'string',
          description: 'Name of the prompt template to retrieve'
        },
        args: {
          type: 'object',
          description: 'Arguments to pass to the prompt template',
          additionalProperties: true
        }
      },
      required: ['serverName', 'promptName']
    }),
    execute: async (args: {
      serverName: string;
      promptName: string;
      args?: Record<string, any>;
    }) => {
      console.log('[SyntheticTools] Executing mcp__get_prompt:', args);

      const session = sessions[args.serverName];
      if (!session) {
        return JSON.stringify({
          error: `Server ${args.serverName} not found`
        });
      }

      try {
        const prompt = await getPrompt(session, args.promptName, args.args || {});

        return JSON.stringify({
          server: args.serverName,
          promptName: args.promptName,
          description: prompt.description,
          messages: prompt.messages
        }, null, 2);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return JSON.stringify({
          error: errorMessage,
          promptName: args.promptName
        });
      }
    }
  };

  console.log('[SyntheticTools] Created 4 synthetic tools for MCP resources and prompts');

  return tools;
}
