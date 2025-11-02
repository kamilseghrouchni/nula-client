import { NextResponse } from 'next/server';
import { fetchSleepyratToken } from '@/lib/mcp/tokenFetcher';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const logs: string[] = [];

  try {
    // Step 1: Get token
    logs.push('[1/3] Fetching authentication token...');
    const token = await fetchSleepyratToken();
    logs.push('[1/3] Token obtained successfully');

    // Step 2: Make request to the MCP endpoint
    logs.push('[2/3] Probing MCP endpoint...');
    const response = await fetch('https://sleepyrat.ai/api/mcp-tools', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    logs.push(`[2/3] Response status: ${response.status} ${response.statusText}`);
    logs.push(`[2/3] Content-Type: ${response.headers.get('content-type')}`);

    // Step 3: Read response body
    logs.push('[3/3] Reading response body...');
    const body = await response.text();
    logs.push(`[3/3] Response body (first 500 chars): ${body.substring(0, 500)}`);

    return NextResponse.json({
      success: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      headers: Object.fromEntries(response.headers.entries()),
      bodyPreview: body.substring(0, 1000),
      bodyLength: body.length,
      logs,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logs.push(`[ERROR] ${errorMessage}`);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorStack,
      logs,
    }, { status: 500 });
  }
}
