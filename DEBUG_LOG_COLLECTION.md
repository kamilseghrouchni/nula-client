# Debug Log Collection Guide

**Purpose:** Identify where parameter name transformations occur in the MCP tool calling flow.

## The Problem

- ✅ **Local STDIO works**: Direct connection to biocontext_kb via uvx - NO errors
- ❌ **Docker SSE fails**: Connection via gateway at localhost:9000/sse - Pydantic validation errors

**Error Example:**
```
1 validation error for call[biocontext_ai_knowledgebase_mcp__bc_get_uniprot_protein_info]
gene_symbol
  Unexpected keyword argument
```

## What We Know

- Local STDIO exposes **snake_case** parameter names (e.g., `gene_symbol`)
- Same MCP server, different transport, different behavior
- Issue is in the routing between SSE client and STDIO backend

---

## Step 1: Start Docker Gateway

```bash
cd mcp-deployment
docker-compose up
```

**Watch for:**
- Gateway startup messages
- List of connected servers
- Tool registration logs

---

## Step 2: Start NulaLabs with SSE Config

Update `mcp-config.json`:
```json
{
  "mcpServers": {
    "biocontext-hub": {
      "transport": "sse",
      "url": "http://localhost:9000/sse"
    }
  }
}
```

Start dev server:
```bash
npm run dev
```

---

## Step 3: Trigger a Tool Call

Navigate to http://localhost:3000/chat and send:
```
Get UniProt info for TP53
```

Or:
```
Search for proteins related to BRCA1
```

---

## Step 4: Collect Logs

### A. Browser Console Logs (Client-Side)

Look for these log entries from `toolConverter.ts`:

**Schema received from gateway:**
```
[ToolConverter] 🔍 Tool biocontext-hub__bc_get_uniprot_protein_info original schema:
{
  "type": "object",
  "properties": {
    "???": { ... }  // Is this camelCase or snake_case?
  }
}
```

**Arguments Claude passes:**
```
[ToolConverter] 🔍 Executing biocontext-hub__bc_get_uniprot_protein_info with args from Claude:
{
  "???": "TP53"  // What parameter name does Claude use?
}
```

**Transformed arguments:**
```
[ToolConverter] 🔄 Parameter transformation: ??? → ???
[ToolConverter] 🔍 Transformed args for MCP server:
{
  "???": "TP53"  // What gets sent to gateway?
}
```

### B. Docker Gateway Logs (Server-Side)

In the terminal running `docker-compose up`, look for:

**Tool call received:**
```
──────────────────────────────────────────────────────────
Gateway Tool Call: biocontext-hub__bc_get_uniprot_protein_info
Backend Server: biocontext-ai-knowledgebase-mcp
Backend Tool: bc_get_uniprot_protein_info
📥 Arguments from SSE client:
{
  "???": "TP53"  // What does gateway receive?
}
──────────────────────────────────────────────────────────
```

**Forwarding to backend:**
```
🔄 Forwarding to backend STDIO server...
   Server: biocontext-ai-knowledgebase-mcp
   Tool: bc_get_uniprot_protein_info
   Args (forwarding as-is): {
     "???": "TP53"  // What gets forwarded to STDIO backend?
   }
```

**Result or error:**
```
✓ Backend returned result successfully
```

OR

```
✗ Backend tool call FAILED:
   Error: 1 validation error for call[bc_get_uniprot_protein_info]
          ??? - Unexpected keyword argument
```

---

## Step 5: Analyze the Data Flow

Fill in this table based on the logs:

| Stage | Location | Parameter Name | Notes |
|-------|----------|----------------|-------|
| 1. MCP Server Schema | Gateway exposes via SSE | ??? | From browser console |
| 2. Claude's Tool Call | toolConverter.ts receives | ??? | What Claude thinks name is |
| 3. After Transformation | toolConverter.ts sends | ??? | After camelCase → snake_case |
| 4. Gateway Receives | gateway.py receives | ??? | From Docker logs |
| 5. Gateway Forwards | gateway.py forwards | ??? | What goes to STDIO backend |
| 6. Backend Expects | Pydantic validation | ??? | From error message |

### Key Questions to Answer:

1. **Does the gateway expose camelCase schemas?**
   - If YES → Problem is in FastMCP framework or gateway schema aggregation
   - If NO → Problem is in how mcp-use SSE transport handles schemas

2. **Does Claude call with camelCase or snake_case?**
   - If camelCase → Confirms schema is exposed as camelCase
   - If snake_case → Something else is wrong

3. **Does the transformation in toolConverter.ts work correctly?**
   - Check if `geneSymbol` becomes `gene_symbol`
   - Or if it's already `gene_symbol` and gets double-transformed

4. **Does the gateway forward parameters unchanged?**
   - Should forward exactly what it receives
   - No transformation should happen in gateway

5. **What does the backend actually expect?**
   - Error message shows what Pydantic expects
   - Compare with what gateway forwarded

---

## Step 6: Determine the Fix

Based on the analysis, choose the appropriate fix:

### Scenario A: Gateway exposes camelCase, backend expects snake_case

**Symptoms:**
- Schema shows `geneSymbol`
- Claude calls with `geneSymbol`
- Transformation converts to `gene_symbol`
- Gateway receives `gene_symbol`
- Backend still errors with "unexpected keyword argument"

**Fix:** Gateway needs to transform parameters before forwarding to STDIO backends.

**Location:** `mcp-hub/gateway.py` line ~357

---

### Scenario B: Schema is correct but transformation breaks it

**Symptoms:**
- Schema shows `gene_symbol`
- Claude calls with `gene_symbol`
- Transformation incorrectly changes it
- Gateway receives wrong parameter name

**Fix:** Disable transformation for SSE gateway tools.

**Location:** `src/lib/mcp/toolConverter.ts` line ~152

---

### Scenario C: FastMCP auto-transforms schemas

**Symptoms:**
- Backend provides `snake_case` schema
- FastMCP exposes `camelCase` to SSE clients
- Transformation works but gateway still uses `camelCase` internally

**Fix:** Configure FastMCP to preserve parameter names OR add inverse transformation in gateway.

**Location:** `mcp-hub/gateway.py` FastMCP initialization

---

### Scenario D: mcp-use SSE transport transforms parameters

**Symptoms:**
- Everything looks correct until SSE transmission
- mcp-use library transforms parameters during SSE communication

**Fix:** Configure mcp-use or work around with parameter mapping.

**Location:** Configuration or workaround in `toolConverter.ts`

---

## Expected Log Output Example

Here's what a complete log collection should look like:

### Browser Console:
```
[ToolConverter] 🔍 Tool biocontext-hub__bc_get_uniprot_protein_info original schema:
{
  "type": "object",
  "properties": {
    "geneSymbol": { "type": "string" }
  }
}

[ToolConverter] 🔍 Executing biocontext-hub__bc_get_uniprot_protein_info with args from Claude:
{ "geneSymbol": "TP53" }

[ToolConverter] 🔄 Parameter transformation: geneSymbol → gene_symbol

[ToolConverter] 🔍 Transformed args for MCP server:
{ "gene_symbol": "TP53" }
```

### Docker Logs:
```
──────────────────────────────────────────────────────────
Gateway Tool Call: biocontext-hub__bc_get_uniprot_protein_info
Backend Server: biocontext-ai-knowledgebase-mcp
Backend Tool: bc_get_uniprot_protein_info
📥 Arguments from SSE client:
{
  "gene_symbol": "TP53"
}
──────────────────────────────────────────────────────────

🔄 Forwarding to backend STDIO server...
   Server: biocontext-ai-knowledgebase-mcp
   Tool: bc_get_uniprot_protein_info
   Args (forwarding as-is): {
  "gene_symbol": "TP53"
}

✓ Backend returned result successfully
```

---

## Resolution

### Root Cause Identified

The issue was in how the gateway registered backend tools. The original implementation used a generic handler:

```python
async def tool_handler(arguments: dict = {}) -> Any:
    # Forward to backend
```

FastMCP generates tool schemas from Python type hints, so this created a generic schema for ALL tools:
```json
{
  "properties": {
    "arguments": {"type": "object", "additionalProperties": true}
  }
}
```

Backend tool schemas with specific parameters like `gene_symbol`, `protein_symbol` were lost.

### Fix Implemented

Refactored gateway to use FastMCP's proxy mounting pattern:

```python
async def mount_proxy_servers(self):
    for server_name, server_info in self.servers.items():
        # Create client for backend
        client_config = {"mcpServers": {server_name: server_info.config}}
        client = Client(client_config)

        # Create proxy server (preserves schemas!)
        proxy_server = FastMCP.from_client(client, name=f"{server_name}_proxy")

        # Mount with prefix for namespacing
        safe_server_name = server_name.replace("/", "_").replace("-", "_")
        self.mcp.mount(safe_server_name, proxy_server)
```

**Benefits:**
- Automatically preserves complete backend tool schemas
- No manual parameter transformation needed
- Official FastMCP pattern for proxy servers
- Maintains tool namespacing

### Testing Steps

After rebuilding the Docker image:

1. Start gateway: `docker-compose up`
2. Check browser console for tool schemas - should show actual parameter names
3. Test tool call with real parameters (e.g., `gene_symbol: "TP53"`)
4. Verify no Pydantic validation errors
5. Confirm both STDIO (local) and SSE (gateway) work identically

## Next Steps

1. **Rebuild Docker image** - Include updated gateway.py with proxy mounting
2. **Test schema exposure** - Verify tools show actual parameter names
3. **Test tool calls** - Confirm Pydantic validation passes
4. **Clean up debug logging** - Remove or reduce logging once confirmed working

---

## Troubleshooting

**Can't see browser console logs?**
- Open DevTools (F12)
- Go to Console tab
- Filter for "ToolConverter" to see only relevant logs

**Can't see Docker logs?**
- Run `docker-compose logs -f mcp-gateway` to follow gateway logs only
- Or `docker-compose logs mcp-gateway | grep "Gateway Tool Call"` to filter

**Gateway not starting?**
- Check if port 9000 is available: `lsof -i :9000`
- Check Docker logs: `docker-compose logs`
- Verify mcp.json exists in container

**No tool calls happening?**
- Check NulaLabs connection to gateway
- Verify mcp-config.json has correct SSE URL
- Check if gateway shows tool registration in startup logs
