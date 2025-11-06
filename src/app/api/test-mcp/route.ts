import { NextResponse } from 'next/server';
import { getMCPClient } from '@/lib/mcp/mcpClient';
import { convertMCPToolsToAISDK } from '@/lib/mcp/toolConverter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Test endpoint for MCP client connectivity
 * Tests connection to all configured MCP servers and lists available tools
 *
 * Usage: GET /api/test-mcp
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const logs: string[] = [];

  try {
    logs.push('[1/3] Initializing MCP client...');
    const mcpClient = await getMCPClient();

    logs.push('[2/3] Getting all active sessions...');
    const sessions = mcpClient.getAllActiveSessions();
    const serverNames = Object.keys(sessions);

    logs.push(`[2/3] Found ${serverNames.length} active server(s): ${serverNames.join(', ')}`);

    logs.push('[3/3] Converting tools to AI SDK format...');
    const tools = await convertMCPToolsToAISDK(sessions);

    const elapsed = Date.now() - startTime;
    logs.push(`[3/3] Success! Loaded ${Object.keys(tools).length} tools in ${elapsed}ms`);

    // Organize tools by server
    const toolsByServer: Record<string, string[]> = {};
    for (const toolName of Object.keys(tools)) {
      const [serverName] = toolName.split('__');
      if (!toolsByServer[serverName]) {
        toolsByServer[serverName] = [];
      }
      toolsByServer[serverName].push(toolName);
    }

    return NextResponse.json({
      success: true,
      connectionTime: elapsed,
      serverCount: serverNames.length,
      servers: serverNames,
      toolCount: Object.keys(tools).length,
      toolsByServer,
      tools: Object.keys(tools),
      logs,
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logs.push(`[ERROR] ${errorMessage}`);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorStack,
      connectionTime: elapsed,
      logs,
    }, { status: 500 });
  }
}
