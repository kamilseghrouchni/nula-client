/**
 * Unified Message Part Normalizer
 *
 * Handles different message part formats from various MCP transports and AI SDK versions:
 *
 * 1. **STDIO (UV MCP)** - AI SDK v5 format:
 *    - Type: 'tool-uv-mcp__toolname'
 *    - Properties: args, result, state
 *
 * 2. **HTTP with SSE (Railway/Sleepyrat)** - AI SDK v4 format via mcp-use:
 *    - Type: 'tool-railway-mcp__toolname'
 *    - Properties: input, output, state
 *
 * 3. **Standard AI SDK** - Direct tool calls:
 *    - Type: 'tool-call' or 'dynamic-tool'
 *    - Properties: toolName, args, result, state
 *
 * This normalizer provides a unified interface for detecting and extracting
 * tool information regardless of the transport mechanism.
 */

export interface NormalizedToolPart {
  /** Fully qualified tool name (e.g., 'uv-mcp__load_csv') */
  toolName: string;
  /** Tool input arguments */
  args: Record<string, any>;
  /** Tool execution result (if available) */
  result: any | null;
  /** Tool execution state */
  state: 'input-available' | 'executing' | 'completed' | 'error';
  /** Original part type for debugging */
  originalType: string;
  /** Source transport type */
  transport: 'stdio' | 'http' | 'standard';
}

/**
 * Check if a message part represents a tool call
 * Works across all MCP transport types
 */
export function isToolPart(part: any): boolean {
  if (!part || !part.type) return false;

  return (
    part.type === 'tool-call' ||
    part.type === 'dynamic-tool' ||
    (typeof part.type === 'string' && part.type.startsWith('tool-')) ||
    !!part.toolName // Has explicit toolName property
  );
}

/**
 * Normalize a tool part to a unified format
 * Returns null if the part is not a tool call
 */
export function normalizeToolPart(part: any): NormalizedToolPart | null {
  if (!isToolPart(part)) return null;

  const originalType = part.type || 'unknown';
  let toolName: string;
  let transport: 'stdio' | 'http' | 'standard';

  // Extract tool name based on format
  if (part.toolName) {
    // Standard AI SDK format
    toolName = part.toolName;
    transport = 'standard';
  } else if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    // MCP transport format: 'tool-{server}__{toolname}' → extract '{server}__{toolname}'
    toolName = part.type.substring(5); // Remove 'tool-' prefix

    // Determine transport based on server name patterns
    if (toolName.startsWith('uv-mcp__')) {
      transport = 'stdio';
    } else if (toolName.startsWith('railway-') || toolName.startsWith('sleepyrat__')) {
      transport = 'http';
    } else {
      transport = 'standard';
    }
  } else {
    // Fallback
    toolName = 'unknown';
    transport = 'standard';
  }

  // Extract arguments (different property names across transports)
  const args = part.args || part.input || {};

  // Extract result (different property names across transports)
  const result = part.result || part.output || null;

  // Extract state (normalize to standard values)
  const state = part.state || (result ? 'completed' : 'input-available');

  return {
    toolName,
    args,
    result,
    state,
    originalType,
    transport,
  };
}

/**
 * Extract tool name from any part format
 * Returns null if not a tool part
 */
export function getToolName(part: any): string | null {
  const normalized = normalizeToolPart(part);
  return normalized?.toolName || null;
}

/**
 * Extract tool arguments from any part format
 * Returns empty object if not a tool part or no args
 */
export function getToolArgs(part: any): Record<string, any> {
  const normalized = normalizeToolPart(part);
  return normalized?.args || {};
}

/**
 * Extract tool result from any part format
 * Returns null if not a tool part or no result
 */
export function getToolResult(part: any): any | null {
  const normalized = normalizeToolPart(part);
  return normalized?.result || null;
}

/**
 * Check if a part is a text content part
 */
export function isTextPart(part: any): boolean {
  return part?.type === 'text';
}

/**
 * Check if a part is a reasoning part (extended thinking)
 */
export function isReasoningPart(part: any): boolean {
  return part?.type === 'reasoning';
}

/**
 * Check if a part is a step marker (used for streaming progress)
 */
export function isStepPart(part: any): boolean {
  return part?.type === 'step-start' || part?.type === 'step-finish';
}

/**
 * Get all tool parts from a message
 * Returns array of normalized tool parts
 */
export function getAllToolParts(message: any): NormalizedToolPart[] {
  if (!message?.parts || !Array.isArray(message.parts)) {
    return [];
  }

  return message.parts
    .map(normalizeToolPart)
    .filter((p): p is NormalizedToolPart => p !== null);
}

/**
 * Get the last tool index in a message (for phase detection)
 */
export function getLastToolIndex(message: any): number {
  if (!message?.parts || !Array.isArray(message.parts)) {
    return -1;
  }

  let lastIndex = -1;
  message.parts.forEach((part: any, idx: number) => {
    if (isToolPart(part)) {
      lastIndex = idx;
    }
  });

  return lastIndex;
}

/**
 * Debug helper: Get transport type from server name in config
 */
export function inferTransportFromServerName(serverName: string): 'stdio' | 'http' {
  // UV servers typically use STDIO
  if (serverName.includes('uv-mcp') || serverName.includes('local')) {
    return 'stdio';
  }

  // Railway, Sleepyrat, and other remote servers use HTTP
  if (serverName.includes('railway') || serverName.includes('sleepyrat') || serverName.includes('remote')) {
    return 'http';
  }

  // Default to STDIO for local development
  return 'stdio';
}
