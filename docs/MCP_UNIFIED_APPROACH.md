# MCP Unified Transport Approach

This document explains the unified architecture for handling multiple MCP (Model Context Protocol) transport types in the NulaLabs application.

## Problem Statement

Different MCP transport mechanisms send message parts in different formats:

### 1. **STDIO Transport** (Local UV MCP)
- **Format**: AI SDK v5 native format
- **Part Type**: `'tool-uv-mcp__toolname'`
- **Properties**: `args`, `result`, `state`
- **Example**:
  ```typescript
  {
    type: 'tool-uv-mcp__load_csv',
    args: { name: 'compound', filepath: 'data.csv' },
    result: '...',
    state: 'completed'
  }
  ```

### 2. **HTTP Transport** (Railway/Sleepyrat via mcp-use)
- **Format**: AI SDK v4 format (mcp-use dependency)
- **Part Type**: `'tool-railway-mcp__toolname'`
- **Properties**: `input`, `output`, `state`
- **Example**:
  ```typescript
  {
    type: 'tool-railway-mcp__analyze',
    input: { dataset: 'compound' },
    output: '...',
    state: 'completed'
  }
  ```

### 3. **Standard AI SDK** (Direct Tool Calls)
- **Format**: AI SDK standard format
- **Part Type**: `'tool-call'` or `'dynamic-tool'`
- **Properties**: `toolName`, `args`, `result`, `state`
- **Example**:
  ```typescript
  {
    type: 'tool-call',
    toolName: 'analyze',
    args: { dataset: 'compound' },
    result: '...',
    state: 'completed'
  }
  ```

## Solution: Unified Message Part Normalizer

We've created a centralized normalization layer that abstracts away transport-specific differences:

### Core Module: `messagePartNormalizer.ts`

Location: `/src/lib/utils/messagePartNormalizer.ts`

#### Key Functions

##### `isToolPart(part: any): boolean`
Detects if a message part represents a tool call across all transports.

```typescript
// Works for all formats:
isToolPart({ type: 'tool-uv-mcp__load_csv' })        // ✅ true (STDIO)
isToolPart({ type: 'tool-railway-mcp__analyze' })   // ✅ true (HTTP)
isToolPart({ type: 'tool-call', toolName: 'x' })    // ✅ true (Standard)
isToolPart({ type: 'text', text: '...' })            // ❌ false
```

##### `normalizeToolPart(part: any): NormalizedToolPart | null`
Converts any tool part to a unified format.

```typescript
interface NormalizedToolPart {
  toolName: string;              // Fully qualified: 'uv-mcp__load_csv'
  args: Record<string, any>;     // Unified from args/input
  result: any | null;            // Unified from result/output
  state: string;                 // Execution state
  originalType: string;          // Original part type (for debugging)
  transport: 'stdio' | 'http' | 'standard';  // Detected transport
}
```

**Example Usage**:
```typescript
// STDIO format
const part1 = {
  type: 'tool-uv-mcp__load_csv',
  args: { name: 'compound' },
  result: 'success'
};

const normalized1 = normalizeToolPart(part1);
// Result: {
//   toolName: 'uv-mcp__load_csv',
//   args: { name: 'compound' },
//   result: 'success',
//   state: 'completed',
//   originalType: 'tool-uv-mcp__load_csv',
//   transport: 'stdio'
// }

// HTTP format
const part2 = {
  type: 'tool-railway-mcp__analyze',
  input: { dataset: 'compound' },
  output: { data: [...] }
};

const normalized2 = normalizeToolPart(part2);
// Result: {
//   toolName: 'railway-mcp__analyze',
//   args: { dataset: 'compound' },
//   result: { data: [...] },
//   state: 'completed',
//   originalType: 'tool-railway-mcp__analyze',
//   transport: 'http'
// }
```

##### Helper Functions

```typescript
// Get tool name from any format
getToolName(part: any): string | null

// Get tool arguments from any format
getToolArgs(part: any): Record<string, any>

// Get tool result from any format
getToolResult(part: any): any | null

// Get all tool parts from a message (normalized)
getAllToolParts(message: any): NormalizedToolPart[]

// Get last tool index in message (for phase detection)
getLastToolIndex(message: any): number
```

## Integration Points

### 1. **MessageItem.tsx** (UI Rendering)

**Before** (Transport-Specific):
```typescript
// Had to manually check all formats
const isToolPart = part.type === 'tool-call' ||
                   part.type === 'dynamic-tool' ||
                   (typeof part.type === 'string' && part.type.startsWith('tool-'));

const toolName = tool.toolName ||
                (tool.type?.startsWith('tool-') ? tool.type.substring(5) : null) ||
                'tool';

const args = tool.args || tool.input || {};
const result = tool.result || tool.output || null;
```

**After** (Unified):
```typescript
import { isToolPart, normalizeToolPart, getLastToolIndex } from '@/lib/utils/messagePartNormalizer';

// Detection
if (isToolPart(part)) {
  const normalized = normalizeToolPart(part);
  // Use normalized.toolName, normalized.args, normalized.result
}

// Phase detection
const lastToolIndex = getLastToolIndex(message);
```

### 2. **dataContext.ts** (Session Context Tracking)

**Before** (Transport-Specific):
```typescript
const toolName = part.toolName ||
                (part.type?.startsWith('tool-') ? part.type.substring(5) : null) ||
                null;
const args = part.args || part.input || {};
const result = part.output || resultPart?.result || resultPart?.output || null;
```

**After** (Unified):
```typescript
import { isToolPart, normalizeToolPart } from '@/lib/utils/messagePartNormalizer';

if (isToolPart(part)) {
  const normalized = normalizeToolPart(part);
  const { toolName, args, result } = normalized;
  // Use directly
}
```

### 3. **workflowBuilder.ts** (Workflow Graph)

Can now use `getAllToolParts(message)` to get all tools with normalized data:

```typescript
import { getAllToolParts } from '@/lib/utils/messagePartNormalizer';

const toolParts = getAllToolParts(message);
toolParts.forEach(normalized => {
  // normalized.toolName, normalized.args, normalized.result available
  // Works for STDIO, HTTP, and standard transports
});
```

## Multi-Server Configuration

### mcp-config.json Format

```json
{
  "mcpServers": {
    "uv-mcp": {
      "command": "/path/to/uv",
      "args": ["--directory", "/path/to/server", "run", "server.py"],
      "env": {},
      "transport": "stdio"
    },
    "railway-server": {
      "url": "https://server.railway.app/api/mcp",
      "authToken": "your-token-here",
      "transport": "http"
    },
    "sleepyrat": {
      "url": "https://sleepyrat.ai/api/mcp-tools",
      "authToken": "${SLEEPYRAT_TOKEN}",  // Runtime injection
      "transport": "http"
    }
  }
}
```

### Runtime Token Injection

For servers requiring dynamic authentication (see `mcpClient.ts`):

```typescript
// Sleepyrat example - token fetched at runtime
if (config.mcpServers.sleepyrat) {
  const token = await fetchSleepyratToken();
  config.mcpServers.sleepyrat = {
    url: 'https://sleepyrat.ai/api/mcp-tools',
    authToken: token,  // Injected at runtime
    transport: 'http'
  };
}
```

## Tool Naming Convention

All tools are namespaced by server name to prevent conflicts:

```
{serverName}__{originalToolName}

Examples:
- uv-mcp__load_csv
- uv-mcp__calculate_cv
- railway-mcp__analyze
- sleepyrat__run_python_code
```

## Benefits of Unified Approach

### ✅ **Single Source of Truth**
- All transport-specific logic centralized in `messagePartNormalizer.ts`
- Easy to add new transport types by updating one module

### ✅ **Type Safety**
- `NormalizedToolPart` interface ensures consistent data structure
- TypeScript catches missing properties at compile time

### ✅ **Simplified Integration**
- UI components (MessageItem, WorkflowCanvas) use simple helper functions
- No need to remember property name differences (args vs input, result vs output)

### ✅ **Future-Proof**
- When AI SDK or mcp-use library updates, only update normalizer
- All consuming code continues to work unchanged

### ✅ **Debugging Support**
- `originalType` and `transport` fields preserved for debugging
- Easy to identify which transport a tool came from

## Adding a New Transport

To add support for a new MCP transport:

1. **Update `isToolPart()`** to detect the new format:
   ```typescript
   export function isToolPart(part: any): boolean {
     return (
       // ... existing checks ...
       part.type === 'new-transport-format' ||  // Add this
       // ...
     );
   }
   ```

2. **Update `normalizeToolPart()`** to extract data:
   ```typescript
   export function normalizeToolPart(part: any): NormalizedToolPart | null {
     // ... existing logic ...

     // Add new transport handling
     if (part.type === 'new-transport-format') {
       toolName = part.customToolName;  // Your format's property
       transport = 'new-transport';
     }

     // Extract args/result based on your format
     const args = part.args || part.customArgs || {};
     const result = part.result || part.customResult || null;

     // ... rest of normalization ...
   }
   ```

3. **All existing code continues to work** - UI, context tracking, workflow building all use the normalized format automatically!

## Testing Different Transports

### Local STDIO (UV MCP)
```json
{
  "mcpServers": {
    "uv-mcp": {
      "command": "/Users/you/.local/bin/uv",
      "args": ["--directory", "/path/to/server", "run", "server.py"],
      "env": {}
    }
  }
}
```

### Remote HTTP (Railway)
```json
{
  "mcpServers": {
    "railway-server": {
      "url": "https://your-server.railway.app/api/mcp",
      "authToken": "token-here",
      "transport": "http"
    }
  }
}
```

### Multi-Server (Both)
```json
{
  "mcpServers": {
    "uv-mcp": { ... },
    "railway-server": { ... },
    "sleepyrat": { ... }
  }
}
```

All formats work seamlessly with the unified normalizer!

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interface Layer                      │
│  (MessageItem.tsx, WorkflowBuilder.ts, etc.)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ Uses helper functions
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              messagePartNormalizer.ts                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  isToolPart(), normalizeToolPart(), etc.              │ │
│  │  Returns: NormalizedToolPart                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────┬──────────────┬────────────────┬──────────────────┘
          │              │                │
          ▼              ▼                ▼
┌─────────────┐  ┌──────────────┐  ┌────────────┐
│   STDIO     │  │     HTTP     │  │  Standard  │
│  (UV MCP)   │  │  (Railway)   │  │  AI SDK    │
│             │  │              │  │            │
│ type: tool- │  │ type: tool-  │  │ type:      │
│ {server}__  │  │ {server}__   │  │ tool-call  │
│ {name}      │  │ {name}       │  │            │
│             │  │              │  │ toolName:  │
│ args: {...} │  │ input: {...} │  │ {...}      │
│ result: ... │  │ output: ...  │  │ args: {...}│
└─────────────┘  └──────────────┘  └────────────┘
```

## Migration Path

Existing code can be gradually migrated:

1. **Phase 1**: Use helper functions in new code
2. **Phase 2**: Refactor existing components one at a time
3. **Phase 3**: Remove old transport-specific logic

The normalizer coexists with old code, no breaking changes!

## Conclusion

The unified message part normalizer provides a robust, maintainable foundation for handling multiple MCP transports. It abstracts away transport-specific differences while preserving debugging information and enabling easy extension for future transport types.

**Key Takeaway**: Write code once using `normalizeToolPart()`, and it works for STDIO, HTTP, and any future transport type automatically!
