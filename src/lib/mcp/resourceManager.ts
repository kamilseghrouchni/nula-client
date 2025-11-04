import type { MCPSession } from 'mcp-use';
import type { ResourceFetchPart } from '@/lib/types';

/**
 * Configuration for resource fetching
 */
export interface ResourceFetchConfig {
  // Maximum size of resource content to fetch (in characters)
  maxContentSize?: number;
  // Filter function to determine which resources to fetch
  resourceFilter?: (resource: any) => boolean;
  // Whether to automatically fetch resource content
  autoFetch?: boolean;
}

/**
 * Result from listing resources across all MCP servers
 */
export interface ResourceListResult {
  resources: Array<{
    serverName: string;
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
  }>;
  totalCount: number;
}

/**
 * List all available resources from all MCP servers
 *
 * @param sessions Record of server names to MCPSession instances
 * @param config Optional configuration for filtering
 * @returns List of available resources with server information
 */
export async function listAllResources(
  sessions: Record<string, MCPSession>,
  config: ResourceFetchConfig = {}
): Promise<ResourceListResult> {
  const { resourceFilter } = config;
  const allResources: ResourceListResult['resources'] = [];

  for (const [serverName, session] of Object.entries(sessions)) {
    try {
      console.log(`[ResourceManager] Listing resources from server: ${serverName}`);

      // List resources from this server
      const result = await session.connector.listResources();

      for (const resource of result.resources) {
        // Apply filter if provided
        if (resourceFilter && !resourceFilter(resource)) {
          continue;
        }

        allResources.push({
          serverName,
          uri: resource.uri,
          name: resource.name,
          title: resource.title,
          description: resource.description,
          mimeType: resource.mimeType
        });
      }

      console.log(`[ResourceManager] Found ${result.resources.length} resources from ${serverName}`);
    } catch (error) {
      console.error(`[ResourceManager] Failed to list resources from ${serverName}:`, error);
      // Continue with other servers
    }
  }

  return {
    resources: allResources,
    totalCount: allResources.length
  };
}

/**
 * Read a specific resource from an MCP server
 *
 * @param session MCP session for the server
 * @param uri Resource URI to read
 * @param maxSize Maximum content size in characters
 * @returns Resource content
 */
export async function readResource(
  session: MCPSession,
  uri: string,
  maxSize: number = 50000
): Promise<{ content: string; mimeType?: string }> {
  console.log(`[ResourceManager] Reading resource: ${uri}`);

  const result = await session.connector.readResource(uri);

  // Combine all content parts
  let content = '';
  for (const item of result.contents) {
    if ('text' in item) {
      content += item.text;
    } else if ('blob' in item) {
      // For binary content, include a placeholder
      content += `[Binary content: ${item.blob.substring(0, 100)}...]`;
    }

    // Check size limit
    if (content.length >= maxSize) {
      content = content.substring(0, maxSize) + '\n\n[Content truncated due to size limit]';
      break;
    }
  }

  return {
    content,
    mimeType: result.contents[0]?.mimeType
  };
}

/**
 * Create a resource-fetch message part
 *
 * @param serverName Name of the MCP server
 * @param resource Resource metadata
 * @param status Fetch status
 * @param content Optional resource content (if fetched)
 * @param error Optional error message
 * @returns ResourceFetchPart
 */
export function createResourceFetchPart(
  serverName: string,
  resource: {
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
  },
  status: 'fetching' | 'complete' | 'error',
  content?: string,
  error?: string
): ResourceFetchPart {
  const part: ResourceFetchPart = {
    type: 'resource-fetch',
    serverName,
    uri: resource.uri,
    status
  };

  if (status === 'complete' && content !== undefined) {
    part.resource = {
      name: resource.name,
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
      content
    };
  }

  if (status === 'error' && error) {
    part.error = error;
  }

  return part;
}

/**
 * Fetch multiple resources and create message parts for visibility
 *
 * @param sessions Record of server names to MCPSession instances
 * @param resourceUris Array of {serverName, uri} pairs to fetch
 * @param config Optional configuration
 * @returns Array of ResourceFetchPart message parts
 */
export async function fetchResourcesWithVisibility(
  sessions: Record<string, MCPSession>,
  resourceUris: Array<{ serverName: string; uri: string }>,
  config: ResourceFetchConfig = {}
): Promise<ResourceFetchPart[]> {
  const { maxContentSize = 50000 } = config;
  const parts: ResourceFetchPart[] = [];

  for (const { serverName, uri } of resourceUris) {
    const session = sessions[serverName];

    if (!session) {
      console.warn(`[ResourceManager] Server ${serverName} not found`);
      continue;
    }

    try {
      // Create fetching part
      const fetchingPart = createResourceFetchPart(
        serverName,
        { uri, name: uri.split('/').pop() || uri },
        'fetching'
      );
      parts.push(fetchingPart);

      // Fetch resource content
      const { content, mimeType } = await readResource(session, uri, maxContentSize);

      // Create complete part
      const completePart = createResourceFetchPart(
        serverName,
        { uri, name: uri.split('/').pop() || uri, mimeType },
        'complete',
        content
      );
      parts.push(completePart);

      console.log(`[ResourceManager] ✅ Fetched resource: ${uri} (${content.length} chars)`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ResourceManager] ❌ Failed to fetch resource ${uri}:`, errorMessage);

      // Create error part
      const errorPart = createResourceFetchPart(
        serverName,
        { uri, name: uri.split('/').pop() || uri },
        'error',
        undefined,
        errorMessage
      );
      parts.push(errorPart);
    }
  }

  return parts;
}

/**
 * Format resource content for injection into system prompt
 *
 * @param resources Array of fetched resources
 * @returns Formatted string for system prompt
 */
export function formatResourcesForPrompt(
  resources: Array<{
    serverName: string;
    uri: string;
    name: string;
    content: string;
    mimeType?: string;
  }>
): string {
  if (resources.length === 0) return '';

  const sections = resources.map(resource => {
    return `### Resource: ${resource.name} (${resource.serverName})
URI: ${resource.uri}
${resource.mimeType ? `Type: ${resource.mimeType}\n` : ''}${resource.content ? `Description: ${resource.content.substring(0, 200)}...\n` : ''}
Content:
\`\`\`
${resource.content}
\`\`\``;
  });

  return `## Available MCP Resources

${sections.join('\n\n---\n\n')}`;
}
