# MCP Code Execution Environment Implementation Plan

**Branch:** `feat/mcp_context_opt`

**Problem:** 250-350 MCP tools consuming 235k+ tokens by loading all tool definitions upfront, exceeding the 200k context limit.

**Solution:** Implement Anthropic's recommended approach - present MCP servers as a virtual filesystem of importable code modules. Agent discovers tools by exploring the filesystem and only loads what it needs on-demand.

**Expected Token Reduction:** From 235k tokens → 3k tokens (98.7% reduction)

---

## Architecture Overview

### Current Architecture (Direct Tool Calls)

```
Docker Container (mcp-hub)
├── 35 MCP servers running as subprocesses
├── Gateway aggregates & exposes via SSE
└── localhost:9000/sse
         ↓
NulaLabs Node.js
├── Connects via mcp-use
├── Loads ALL 350 tool definitions into context (235k tokens)
├── Claude sees all tools upfront
└── Each tool call passes through Claude context
```

**Token Breakdown:**
- System prompt: ~8k tokens
- Tool definitions: ~235k tokens ❌ (exceeds limit)
- Messages: ~20k tokens
- **Total: ~263k tokens** (exceeds 200k limit)

### New Architecture (Code Execution)

```
Docker Container (mcp-hub)
├── 35 MCP servers (unchanged)
└── localhost:9000/sse
         ↓
NulaLabs Node.js
├── Connects via mcp-use
├── Generates virtual filesystem from tool schemas (in-memory)
├── Virtual FS: /workspace/servers/{server_name}/{tool_name}.ts
├── Claude sees filesystem tree only (~2k tokens)
├── Claude writes code to import/call tools
├── Code executes in sandbox
├── Sandbox has callMCPTool() bridge to gateway
└── Only filtered results return to Claude
```

**Token Breakdown:**
- System prompt: ~8k tokens
- Filesystem tree: ~2k tokens ✅
- Tools loaded on-demand: ~1k tokens (5 tools × 200 tokens)
- Messages: ~20k tokens
- **Total: ~31k tokens** (well under 200k limit)

---

## Virtual Filesystem Design

### Runtime Generation (Not Docker Image)

The virtual filesystem is **generated at runtime** in the NulaLabs Node.js process:

1. NulaLabs connects to mcp-hub gateway via SSE (existing)
2. Receives tool schemas from gateway (existing)
3. **NEW:** Transform tool schemas → virtual filesystem structure
4. Virtual FS stored as in-memory JavaScript object
5. Code execution sandbox "reads" from this object

**No Docker image changes needed** - gateway continues exposing tools via SSE.

### Filesystem Structure

```
/workspace/
├── servers/
│   ├── biocontext_hub/
│   │   ├── index.ts                          # Export all tools
│   │   ├── bc_get_uniprot_protein_info.ts   # One file per tool
│   │   ├── search_diseases.ts
│   │   └── ... (all tools)
│   ├── sleepyrat/
│   │   ├── index.ts
│   │   └── analyze.ts
│   └── client.ts                             # callMCPTool bridge
└── skills/                                   # Future: reusable functions
```

### Tool File Format

Each tool is a minimal TypeScript file with:
- Type interfaces for input/output
- One-line description comment
- Function that calls `callMCPTool()`

**Example:**
```typescript
// /workspace/servers/biocontext_hub/bc_get_uniprot_protein_info.ts
import { callMCPTool } from "../../client";

interface Input {
  gene_symbol: string;
}

interface Response {
  protein_name: string;
  protein_id: string;
  // ... other fields
}

/* Get UniProt protein information for a gene symbol */
export async function bc_get_uniprot_protein_info(
  input: Input
): Promise<Response> {
  return callMCPTool('biocontext-hub__bc_get_uniprot_protein_info', input);
}
```

**Key:** Only SHORT comment and type signatures. Full verbose descriptions NOT included.

### In-Memory Implementation

```typescript
// Virtual filesystem = JavaScript object
const virtualFilesystem: Record<string, string> = {
  '/workspace/servers/biocontext_hub/index.ts': `
    export * from './bc_get_uniprot_protein_info';
    export * from './search_diseases';
    // ... all tool exports
  `,
  '/workspace/servers/biocontext_hub/bc_get_uniprot_protein_info.ts': `
    import { callMCPTool } from "../../client";
    // ... tool implementation
  `,
  // ... all other files
};

// Sandbox "reads" from this object when code imports modules
```

---

## Implementation Plan

### Phase 1: Virtual Filesystem Generation

**Files to Create:**

1. **`src/lib/mcp/codeEnvironment/filesystemGenerator.ts`**
   ```typescript
   export function generateVirtualFilesystem(
     sessions: Record<string, MCPSession>
   ): VirtualFilesystem {
     // Transform MCP tool schemas → TypeScript code files
     // Return in-memory filesystem object
   }
   ```

2. **`src/lib/mcp/codeEnvironment/virtualFilesystem.ts`**
   ```typescript
   export interface VirtualFilesystem {
     files: Record<string, string>;
   }

   export function readFile(fs: VirtualFilesystem, path: string): string;
   export function listDirectory(fs: VirtualFilesystem, path: string): string[];
   export function exists(fs: VirtualFilesystem, path: string): boolean;
   ```

**Test:** Generate filesystem from MCP sessions, verify structure.

---

### Phase 2: Code Execution Sandbox

**Files to Create:**

3. **`src/lib/sandbox/securityPolicy.ts`**
   ```typescript
   export const SANDBOX_CONFIG = {
     timeout: 5000,           // 5 second max execution
     memoryLimit: 512 * 1024, // 512MB
     allowedBuiltins: [       // Whitelist
       'console',
       'Promise',
       'Array',
       // ... basic JavaScript globals
       // NO: fs, child_process, net, http
     ]
   };
   ```

4. **`src/lib/sandbox/codeExecutor.ts`**
   ```typescript
   export async function executeCode(
     code: string,
     virtualFS: VirtualFilesystem,
     mcpBridge: MCPBridge
   ): Promise<ExecutionResult> {
     // Use VM2 or isolated-vm for sandboxing
     // Provide virtual filesystem as module resolver
     // Provide callMCPTool as global function
     // Execute code with resource limits
     // Return stdout/stderr and result
   }
   ```

5. **`src/lib/mcp/codeEnvironment/mcpBridge.ts`**
   ```typescript
   export function createMCPBridge(
     sessions: Record<string, MCPSession>
   ): MCPBridge {
     return {
       callMCPTool: async (toolName: string, args: any) => {
         // Parse tool name to find correct session
         // Route call to appropriate MCP session
         // Return result (stays in sandbox unless logged)
       }
     };
   }
   ```

**Test:** Execute simple code in sandbox, verify isolation and MCP bridge works.

---

### Phase 3: Integration with Chat API

**Files to Modify:**

6. **`src/app/api/chat/route.ts`**

Replace current tool loading:
```typescript
// OLD: Load all 350 tools
const tools = await convertMCPToolsToAISDK(sessions);

// NEW: Generate virtual filesystem and provide 3 meta-tools
const virtualFS = generateVirtualFilesystem(sessions);
const mcpBridge = createMCPBridge(sessions);

const tools = {
  execute_code: {
    description: "Execute TypeScript code with access to MCP servers via imports",
    parameters: {
      code: {
        type: "string",
        description: "TypeScript code to execute. Can import from ./servers/{server_name}"
      }
    },
    execute: async ({ code }: { code: string }) => {
      const result = await executeCode(code, virtualFS, mcpBridge);
      return result.output; // stdout/stderr + return value
    }
  },

  list_servers: {
    description: "List all available MCP servers in the code environment",
    parameters: {},
    execute: async () => {
      return listDirectory(virtualFS, '/workspace/servers');
    }
  },

  read_tool_definition: {
    description: "Read the TypeScript definition for a specific tool",
    parameters: {
      server_name: { type: "string", description: "Server name (e.g. biocontext_hub)" },
      tool_name: { type: "string", description: "Tool name (e.g. bc_get_uniprot_protein_info)" }
    },
    execute: async ({ server_name, tool_name }: { server_name: string, tool_name: string }) => {
      const path = `/workspace/servers/${server_name}/${tool_name}.ts`;
      return readFile(virtualFS, path);
    }
  }
};
```

Add filesystem tree to system prompt:
```typescript
const filesystemTree = generateFilesystemTree(virtualFS);
const systemPromptWithCodeEnv = `${baseSystemPrompt}

## MCP Code Execution Environment

You have access to MCP servers via a TypeScript code execution environment.

### Available Servers

${filesystemTree}

### Usage

To call MCP tools:

1. **Explore servers:** Use list_servers() to see available servers
2. **Read tool definitions:** Use read_tool_definition(server_name, tool_name) to see a tool's TypeScript interface
3. **Write code:** Import and call tools using TypeScript
4. **Execute:** Use execute_code({ code: "..." }) to run your code

### Example

\`\`\`typescript
// Import tools from a server
import * as biocontext from './servers/biocontext_hub';

// Call a tool
const protein = await biocontext.bc_get_uniprot_protein_info({
  gene_symbol: "TP53"
});

// Process results in code (doesn't consume your context!)
const summary = \`Protein: \${protein.protein_name} (ID: \${protein.protein_id})\`;
console.log(summary);
\`\`\`

### Benefits

- **Progressive disclosure:** Only load tools you need
- **Data filtering:** Process large datasets in code before returning
- **Complex logic:** Use loops, conditionals, error handling
- **Privacy:** Intermediate results stay in sandbox unless explicitly logged

### Important

- All code runs in a secure sandbox
- Timeout: 5 seconds
- Memory limit: 512MB
- Console.log() output is returned to you
`;
```

7. **`src/lib/prompts/system.ts`**

Add code environment documentation section (shown above).

**Test:** End-to-end with Claude - user query → Claude writes code → executes → returns result.

---

## Progressive Disclosure Flow

### Example User Query: "Get UniProt info for TP53"

**Traditional Approach (Current):**
```
Context loaded:
- 350 tool definitions (235k tokens)
- Claude picks: biocontext-hub__bc_get_uniprot_protein_info
- Direct tool call
- Result flows through context

Tokens: 235k upfront
```

**Code Execution Approach (New):**
```
Step 1: Claude sees filesystem tree (2k tokens)
        "What servers are available?"

Step 2: Claude explores
        execute_code({ code: "list_servers()" })
        Returns: ["biocontext_hub", "sleepyrat", ...]

Step 3: Claude reads specific tool
        read_tool_definition("biocontext_hub", "bc_get_uniprot_protein_info")
        Returns: TypeScript file content (~200 tokens)

Step 4: Claude writes code
        execute_code({
          code: `
            import * as biocontext from './servers/biocontext_hub';
            const result = await biocontext.bc_get_uniprot_protein_info({
              gene_symbol: "TP53"
            });
            console.log(result);
          `
        })

Step 5: Code executes in sandbox
        - Calls MCP tool via bridge
        - Result stays in sandbox
        - Only console.log output returns to Claude

Tokens: 2k tree + 200 tool def + 500 code = ~2.7k tokens
```

---

## Security Model

### Sandbox Configuration

**Isolation:** VM2 or isolated-vm
- Code runs in separate V8 context
- No access to parent process
- No file system access (except virtual FS)
- No network access (except MCP bridge)

**Resource Limits:**
- CPU timeout: 5 seconds
- Memory limit: 512MB
- No infinite loops (timeout enforces)

**Allowed Imports:**
- Virtual filesystem modules only (`./servers/*`)
- Basic JavaScript globals (console, Promise, Array, etc.)

**Blocked Imports:**
- `fs`, `child_process`, `net`, `http`, `https`
- `require()` for external modules
- Dynamic `eval()` or `Function()` constructor

**MCP Bridge:**
- Only way to call external systems
- Routes through validated MCP sessions
- Tool names validated before execution

### Privacy & Data Handling

**Intermediate Results Stay in Sandbox:**
```typescript
// Large dataset never enters Claude context
const allRows = await gdrive.getSheet({ sheetId: 'abc123' });
// 10,000 rows processed in sandbox
const filtered = allRows.filter(r => r.status === 'pending');
// Only summary returned
console.log(`Found ${filtered.length} pending orders`);
console.log(filtered.slice(0, 5)); // First 5 rows only
```

Claude sees:
```
Found 234 pending orders
[5 rows shown]
```

Not: [10,000 rows in context]

---

## Benefits

### 1. Massive Token Reduction

**Before:**
- All tools loaded: 235k tokens
- Exceeds 200k context limit
- Slow, expensive, often fails

**After:**
- Filesystem tree: 2k tokens
- Tools on-demand: ~1k tokens (5 tools avg)
- Total: ~3k tokens
- **98.7% reduction**

### 2. Context-Efficient Tool Results

**Example: Filtering Large Dataset**

```typescript
// Without code execution
// All 10k rows through context to filter
TOOL CALL: gdrive.getSheet(sheetId: 'abc123')
→ 10,000 rows loaded into context (100k tokens)
→ Claude filters manually
→ Returns 234 pending orders

// With code execution
// Filter in sandbox, minimal context usage
const allRows = await gdrive.getSheet({ sheetId: 'abc123' });
const pending = allRows.filter(r => r.status === 'pending');
console.log(`${pending.length} pending orders`);
// Only log entry returns (50 tokens)
```

**Token savings: 99,950 tokens**

### 3. Complex Workflows

**Example: Multi-step Pipeline**

```typescript
// Fetch data from multiple sources
const diseases = await biocontext.search_diseases({
  query: "cancer"
});

// Process each disease
const results = [];
for (const disease of diseases.slice(0, 10)) {
  const proteins = await biocontext.get_disease_proteins({
    disease_id: disease.id
  });

  const topProtein = proteins.sort((a, b) =>
    b.relevance_score - a.relevance_score
  )[0];

  results.push({
    disease: disease.name,
    key_protein: topProtein.name
  });
}

console.log(JSON.stringify(results, null, 2));
```

**Without code execution:** Each tool call goes through context
**With code execution:** Loop runs in sandbox, only final results return

### 4. State Persistence (Future)

```typescript
// Save intermediate results
const leads = await salesforce.query({
  query: 'SELECT Id, Email FROM Lead'
});
await fs.writeFile('./workspace/leads.csv', toCSV(leads));

// Later execution picks up where it left off
const saved = await fs.readFile('./workspace/leads.csv');
```

### 5. Reusable Skills (Future)

```typescript
// Save working code as reusable function
// In ./skills/fetch-protein-info.ts
export async function fetchProteinInfo(geneSymbol: string) {
  const protein = await biocontext.bc_get_uniprot_protein_info({
    gene_symbol: geneSymbol
  });
  return {
    name: protein.protein_name,
    id: protein.protein_id,
    summary: `${protein.protein_name} (${protein.protein_id})`
  };
}

// Later, in any execution
import { fetchProteinInfo } from './skills/fetch-protein-info';
const info = await fetchProteinInfo('TP53');
```

---

## Implementation Order

### Phase 1: Foundation (Week 1)
1. Create feature branch `feat/mcp_context_opt`
2. Implement virtual filesystem generation
3. Create in-memory filesystem abstraction
4. Unit tests for filesystem generation

### Phase 2: Sandbox (Week 1-2)
5. Implement security policy
6. Build code executor with VM2/isolated-vm
7. Create MCP bridge
8. Unit tests for sandbox execution

### Phase 3: Integration (Week 2)
9. Modify chat route to use new tools
10. Update system prompt with documentation
11. Add feature flag `USE_CODE_EXECUTION=false`
12. Integration tests

### Phase 4: Testing (Week 2-3)
13. E2E tests with various query types
14. Performance benchmarking (tokens, latency)
15. A/B testing in development

### Phase 5: Rollout (Week 3-4)
16. Enable for beta users
17. Monitor metrics (success rate, token usage)
18. Gradual rollout to production
19. Deprecate old direct tool calling

---

## Testing Strategy

### Unit Tests

**Filesystem Generation:**
```typescript
test('generates correct file structure', () => {
  const mockSessions = createMockMCPSessions();
  const fs = generateVirtualFilesystem(mockSessions);

  expect(fs.files['/workspace/servers/biocontext_hub/index.ts']).toBeDefined();
  expect(fs.files['/workspace/servers/biocontext_hub/bc_get_uniprot_protein_info.ts']).toContain('export async function');
});
```

**Code Execution:**
```typescript
test('executes code in sandbox', async () => {
  const code = `console.log('Hello'); return 42;`;
  const result = await executeCode(code, mockFS, mockBridge);

  expect(result.stdout).toBe('Hello\n');
  expect(result.returnValue).toBe(42);
});

test('enforces timeout', async () => {
  const code = `while(true) {}`;
  await expect(executeCode(code, mockFS, mockBridge)).rejects.toThrow('Timeout');
});
```

**MCP Bridge:**
```typescript
test('routes tool calls correctly', async () => {
  const bridge = createMCPBridge(mockSessions);
  const result = await bridge.callMCPTool('biocontext-hub__search_diseases', {
    query: 'cancer'
  });

  expect(result).toBeDefined();
  expect(mockSessions.biocontextHub.connector.callTool).toHaveBeenCalled();
});
```

### Integration Tests

**End-to-End:**
```typescript
test('user query executes via code environment', async () => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Get UniProt info for TP53' }]
    })
  });

  // Verify Claude wrote code
  expect(response).toContain('execute_code');
  // Verify code imported tools
  expect(response).toContain('import');
  // Verify result returned
  expect(response).toContain('TP53');
});
```

### Performance Benchmarks

**Token Usage:**
```typescript
test('reduces token usage by >90%', () => {
  const oldApproach = measureTokens(loadAllTools());
  const newApproach = measureTokens(generateFilesystemTree());

  const reduction = (oldApproach - newApproach) / oldApproach;
  expect(reduction).toBeGreaterThan(0.9); // >90% reduction
});
```

**Latency:**
```typescript
test('completes queries within acceptable time', async () => {
  const start = Date.now();
  await executeUserQuery('Get protein info for TP53');
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(5000); // Under 5 seconds
});
```

---

## Rollout Plan

### Phase 1: Development Only
- Feature flag `USE_CODE_EXECUTION=false` (default off)
- Manual testing by developers
- Iterate on implementation

### Phase 2: Beta Testing
- Enable for internal team
- Collect feedback on usability
- Monitor token usage metrics
- Fix bugs and edge cases

### Phase 3: Limited Production
- Enable for 10% of users (A/B test)
- Compare metrics:
  - Token usage
  - Query success rate
  - User satisfaction
  - Latency
- Gradually increase to 50%

### Phase 4: Full Rollout
- Enable for 100% of users
- Monitor for issues
- Keep old approach as fallback
- After stable period, remove old code

---

## Success Metrics

### Token Usage
- **Target:** 90%+ reduction in tool-related tokens
- **Measurement:** Average tokens per request
- **Before:** ~235k tokens
- **After:** ~3k tokens

### Latency
- **Target:** Comparable or better end-to-end latency
- **Measurement:** Time from user query to response
- **Expected:** Context reduction saves more than sandbox execution costs

### Success Rate
- **Target:** >95% query success rate (no regressions)
- **Measurement:** Queries completed without errors
- **Monitor:** Code execution errors, tool call failures

### Cost
- **Target:** 90%+ reduction in API costs per query
- **Measurement:** Anthropic API token charges
- **Expected:** Massive savings from context reduction

---

## Future Enhancements

### 1. State Persistence
- Allow code to save files to `/workspace/`
- Persist across conversation turns
- Enable multi-step workflows

### 2. Skills System
- Save working code as reusable functions
- Build library of domain-specific operations
- Share skills across users (with permission)

### 3. Streaming Execution
- Stream console.log output in real-time
- Show progress bars for long-running operations
- Better UX for multi-step workflows

### 4. Enhanced Security
- Per-user code execution sandboxes
- Rate limiting and resource quotas
- Audit logging for sensitive operations

### 5. Tool Search
- Implement semantic search over tool descriptions
- Vector embeddings for finding relevant tools
- Reduce discovery overhead further

---

## Reference

### Anthropic Article
**"Code execution with MCP improves context efficiency"**
https://www.anthropic.com/engineering/code-execution-mcp

**Key Quote:**
> "Code execution with MCP enables agents to use context more efficiently by loading tools on demand, filtering data before it reaches the model, and executing complex logic in a single step. This reduces the token usage from 150,000 tokens to 2,000 tokens—a time and cost saving of 98.7%."

### Cloudflare Implementation
**"Code Mode" with MCP**
Similar approach, same 98.7% token reduction results.

---

## Questions & Decisions

### Q: Why not use Anthropic's Tool Search Tool (beta)?
**A:** Vercel AI SDK doesn't support it yet, and we'd need to switch to direct Anthropic SDK. Code execution is more flexible and supported by AI SDK.

### Q: What if code execution adds too much latency?
**A:** Initial testing will measure this. If needed, we can:
- Cache compiled code
- Optimize sandbox startup
- Run execution in parallel with streaming
- Use faster VM (isolated-vm vs VM2)

### Q: What about tool discovery - how does Claude find tools?
**A:** Three approaches:
1. Filesystem exploration (list_servers, read files)
2. Search tool (future enhancement)
3. Describe task → Claude infers relevant servers

### Q: Security concerns with running user-generated code?
**A:** Mitigated by:
- VM2/isolated-vm sandboxing
- Resource limits (CPU, memory)
- No filesystem/network access
- Whitelist allowed operations
- User code never shared between sessions

### Q: Backward compatibility?
**A:** Feature flag allows both approaches:
- `USE_CODE_EXECUTION=true` → New approach
- `USE_CODE_EXECUTION=false` → Old approach (fallback)

---

## Summary

**Problem:** 250-350 MCP tools consuming 235k+ tokens, exceeding context limit

**Solution:** Virtual filesystem of tools, code execution environment, on-demand loading

**Impact:** 98.7% token reduction (235k → 3k), enabling unlimited tool scaling

**Timeline:** 3-4 weeks from implementation to full production rollout

**Risk:** Low - feature flagged, well-tested, backed by Anthropic's research

**ROI:** Massive - enables scaling to thousands of tools, 90%+ cost reduction

---

## Next Steps

1. Review and approve this plan
2. Create feature branch `feat/mcp_context_opt`
3. Begin Phase 1 implementation (virtual filesystem)
4. Weekly progress reviews
5. Launch beta in 2-3 weeks

---

**Document Version:** 1.0
**Date:** 2025-11-26
**Status:** Awaiting Approval
