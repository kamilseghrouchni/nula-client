# MCP BioContext Integration

**Complete guide to how NulaLabs connects to BioContextAI's MCP Hub and manages the registry of available MCP servers.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     NulaLabs Client                          │
│                 (http://localhost:3001)                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          MCP Client (mcp-use library)                │   │
│  │                                                       │   │
│  │  • Singleton instance: src/lib/mcp/mcpClient.ts     │   │
│  │  • Config: mcp-config.json                          │   │
│  │  • Supports: SSE, HTTP, STDIO transports           │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ SSE Connection
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BioContextAI MCP Gateway Hub                    │
│                 (http://localhost:9000/sse)                  │
│                                                               │
│  Features:                                                    │
│  • Aggregates 46+ MCP servers into single endpoint          │
│  • Dynamic tool registration and routing                     │
│  • Built-in hub_list_servers tool for discovery            │
│  • Automatic server health monitoring                        │
│  • Unified tool namespace (server__tool_name)               │
└─────────┬──────────┬──────────┬──────────┬─────────────────┘
          │          │          │          │
    ┌─────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
    │biocontext│ │biothings│ │ gget  │ │clinical│
    │  :8000  │ │  :8001 │ │ :8002 │ │ :8003 │
    └─────────┘ └────────┘ └────────┘ └────────┘
         Individual MCP Servers (STDIO subprocesses)
```

---

## Connection Flow

### 1. Client Initialization (`src/lib/mcp/mcpClient.ts`)

```typescript
export async function getMCPClient(): Promise<MCPClient> {
  if (mcpClient) {
    return mcpClient; // Singleton pattern
  }

  // Load configuration from project root
  const configPath = path.join(process.cwd(), 'mcp-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Create client from config
  mcpClient = MCPClient.fromDict(config);

  // Establish sessions with all configured servers
  await mcpClient.createAllSessions();

  return mcpClient;
}
```

**Key Points:**
- **Singleton pattern**: One client instance for the entire application
- **Auto-connects**: All servers defined in `mcp-config.json`
- **Graceful degradation**: If one server fails, others continue
- **Session pooling**: Reuses connections across API calls

---

## Configuration (`mcp-config.json`)

Current NulaLabs configuration:

```json
{
  "mcpServers": {
    "biocontext-hub": {
      "transport": "sse",
      "url": "http://localhost:9000/sse"
    },
    "sleepyrat": {
      "url": "https://sleepyrat.ai/api/mcp-tools",
      "authToken": "${SLEEPYRAT_TOKEN}",
      "transport": "http"
    }
  }
}
```

### Transport Types

| Transport | Use Case | Example |
|-----------|----------|---------|
| **SSE** | Server-Sent Events for streaming | BioContext Hub |
| **HTTP** | Direct HTTP requests | Remote APIs (Sleepyrat) |
| **STDIO** | Subprocess communication | Local CLI tools |

---

## BioContextAI MCP Hub Gateway

The gateway (`mcp-hub/gateway.py`) aggregates all MCP servers into a unified interface.

### Gateway Responsibilities

1. **Server Discovery**: Loads `mcp.json` configuration
2. **Process Management**: Spawns STDIO servers as subprocesses
3. **Remote Proxying**: Connects to remote SSE/HTTP servers
4. **Tool Aggregation**: Merges all tools with namespacing
5. **Health Monitoring**: Tracks server status
6. **Dynamic Routing**: Routes tool calls to correct backend

### Built-in Gateway Tools

#### `hub_list_servers` Tool

**Purpose**: Discover all available MCP servers and their tools dynamically

**Implementation** (`mcp-hub/gateway.py:370-384`):
```python
@self.mcp.tool(name="hub_list_servers", description="List all connected MCP servers")
async def list_servers() -> dict:
    """Return list of all servers and their tools."""
    return {
        "servers": [
            {
                "name": name,
                "connected": info.is_connected,
                "is_remote": info.is_remote,
                "tool_count": len(info.tools),
                "tools": [t["name"] for t in info.tools],
            }
            for name, info in self.servers.items()
        ],
    }
```

**Response Example**:
```json
{
  "servers": [
    {
      "name": "biocontext-ai-knowledgebase-mcp",
      "connected": true,
      "is_remote": false,
      "tool_count": 8,
      "tools": [
        "search_diseases",
        "search_genes",
        "search_proteins",
        "get_disease_info",
        "get_gene_info",
        "get_protein_info",
        "get_pathway_info",
        "search_literature"
      ]
    },
    {
      "name": "longevity-genie-gget-mcp",
      "connected": true,
      "is_remote": false,
      "tool_count": 12,
      "tools": ["gget_archs4", "gget_blast", "gget_enrichr", ...]
    }
  ]
}
```

---

## Registry System

### How the Registry Gets Updated

The BioContextAI ecosystem uses a **centralized registry** at https://biocontext.ai/registry

#### Registry Architecture

```
┌────────────────────────────────────────────┐
│    BioContextAI Registry (Web Service)      │
│    https://biocontext.ai/registry           │
│                                              │
│  • 46+ MCP servers                          │
│  • Metadata: category, tags, author         │
│  • GitHub repo URLs                         │
│  • Installation commands                    │
└────────────────┬───────────────────────────┘
                 │
                 ▼ Fetch
┌────────────────────────────────────────────┐
│   mcp-deployment/scripts/fetch-registry.py  │
│                                              │
│  Downloads registry → registry-cache.json   │
└────────────────┬───────────────────────────┘
                 │
                 ▼ Extract
┌────────────────────────────────────────────┐
│  mcp-deployment/scripts/extract-configs.py  │
│                                              │
│  Clones repos → Extracts MCP configs       │
│  → mcp-configs.json                        │
└────────────────┬───────────────────────────┘
                 │
                 ▼ Generate
┌────────────────────────────────────────────┐
│  mcp-deployment/scripts/generate-compose.py │
│                                              │
│  Creates docker-compose.yml + Dockerfiles  │
└────────────────┬───────────────────────────┘
                 │
                 ▼ Deploy
┌────────────────────────────────────────────┐
│  mcp-deployment/scripts/deploy.sh           │
│                                              │
│  Builds containers → Starts gateway        │
└────────────────────────────────────────────┘
```

### Registry Update Flow

**Step 1: Fetch Latest Registry**
```bash
cd mcp-deployment
.venv/bin/python scripts/fetch-registry.py
```

Downloads the latest server list from BioContextAI:
- **Output**: `config/registry-cache.json`
- **Contains**: Server names, GitHub URLs, categories, tags

**Step 2: Extract MCP Configurations**
```bash
.venv/bin/python scripts/extract-configs.py
```

For each server in the registry:
1. Clones the GitHub repository
2. Parses `README.md` to find MCP configuration
3. Extracts `command`, `args`, `env` for running the server
4. Stores in `config/mcp-configs.json`

**Step 3: Generate Docker Compose Setup**
```bash
.venv/bin/python scripts/generate-compose.py
```

Creates deployment files:
- `docker-compose.yml`: Service definitions for all servers
- `servers/*/Dockerfile`: Individual server containers
- `.env.example`: Environment variable template

**Step 4: Deploy All Services**
```bash
./scripts/deploy.sh
```

Orchestrates the full deployment:
1. Builds Docker images for each server
2. Starts all containers via Docker Compose
3. Launches the MCP Gateway
4. Gateway connects to all servers
5. Tools aggregated and exposed via SSE

---

## How `hub_list_servers` Provides Full Registry Access

### Dynamic Server Discovery

When NulaLabs calls `hub_list_servers`, it receives:
1. **All connected servers**: Names and connection status
2. **Tool inventory**: Complete list of available tools per server
3. **Metadata**: Remote vs local, tool counts

### Client-Side Tool Loading (`src/lib/mcp/toolConverter.ts`)

```typescript
export async function convertMCPToolsToAISDK(
  sessions: Record<string, MCPSession>
): Promise<Record<string, CoreTool>> {
  const tools: Record<string, CoreTool> = {};

  for (const [serverName, session] of Object.entries(sessions)) {
    const serverTools = await session.listTools();

    for (const tool of serverTools) {
      // Namespace tools by server name
      const toolName = `${serverName}__${tool.name}`;

      tools[toolName] = {
        description: tool.description || `Tool from ${serverName}`,
        parameters: tool.inputSchema || {},
        execute: async (args) => {
          const result = await session.callTool(tool.name, args);
          return result;
        },
      };
    }
  }

  return tools;
}
```

**Tool Namespacing**: Prevents name collisions
- Example: `biocontext__search_diseases` vs `gget__search_diseases`

---

## Integration Points

### 1. API Route (`src/app/api/chat/route.ts`)

When a chat request comes in:

```typescript
// Initialize MCP client (connects to gateway)
const mcpClient = await getMCPClient();

// Get all active sessions
const sessions = mcpClient.getAllActiveSessions();
// → { "biocontext-hub": Session, "sleepyrat": Session }

// Convert to AI SDK tools
const tools = await convertMCPToolsToAISDK(sessions);
// → { "biocontext-hub__hub_list_servers": Tool, "biocontext-hub__search_diseases": Tool, ... }

// Pass tools to Claude
const result = streamText({
  model: anthropic('claude-sonnet-4-5'),
  tools,
  messages,
});
```

### 2. Dynamic Tool Discovery

The AI can call `hub_list_servers` at runtime:

```
User: "What tools are available?"

Claude: Let me check...
[Calls hub_list_servers tool]

Response:
"You have access to 120+ tools across 46 servers:
- BioContext Knowledgebase: 8 tools for diseases, genes, proteins
- gget: 12 tools for genomics data retrieval
- BioThings: 15 tools for biological entity lookups
..."
```

---

## Deployment Options

### Option 1: Gateway Mode (Current Setup)

**Single unified connection:**

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

**Advantages**:
- ✅ Single connection to manage
- ✅ Automatic tool aggregation
- ✅ Centralized health monitoring
- ✅ Dynamic server discovery via `hub_list_servers`
- ✅ Scales to 100+ servers without config changes

**How It Works**:
1. NulaLabs connects to gateway once
2. Gateway manages 46+ individual servers
3. All tools available through single session
4. Tool calls automatically routed to correct backend

---

### Option 2: Direct Mode

**Individual server connections:**

```json
{
  "mcpServers": {
    "biocontext-ai-knowledgebase-mcp": {
      "transport": "http",
      "url": "http://localhost:8000/mcp"
    },
    "longevity-genie-gget-mcp": {
      "transport": "http",
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

**Advantages**:
- ✅ Fine-grained control per server
- ✅ Direct access (no gateway overhead)
- ✅ Easier debugging

**Disadvantages**:
- ❌ Must configure each server individually
- ❌ No automatic discovery
- ❌ N connections instead of 1

---

## Server Selection (`mcp-deployment/config/selection.yaml`)

Control which servers get deployed:

```yaml
# Install specific servers
strategy: "specific"
servers:
  - biocontext-ai/knowledgebase-mcp
  - longevity-genie/gget-mcp
  - cyanheads/clinicaltrialsgov-mcp-server

# Or by category
strategy: "category"
categories:
  - genomics
  - proteomics

# Or by tags
strategy: "tags"
tags:
  - protein-protein interaction
  - drug discovery

# Or all (resource-intensive!)
strategy: "all"
```

---

## Auto-Configuration Generation

Generate `mcp-config.json` for NulaLabs automatically:

```bash
cd mcp-deployment

# Gateway mode (recommended)
.venv/bin/python scripts/generate-nula-config.py \
  --mode gateway \
  --output ../mcp-config.json

# Direct mode (individual servers)
.venv/bin/python scripts/generate-nula-config.py \
  --mode direct \
  --output ../mcp-config.json

# Merge with existing config
.venv/bin/python scripts/generate-nula-config.py \
  --mode gateway \
  --merge
```

---

## Health Monitoring

### Gateway Health Endpoints

**Check Gateway Status:**
```bash
curl http://localhost:9000/health
```

**Response:**
```json
{
  "status": "healthy",
  "servers": {
    "biocontext-ai-knowledgebase-mcp": {
      "connected": true,
      "tools": 8,
      "error": null
    },
    "longevity-genie-gget-mcp": {
      "connected": true,
      "tools": 12,
      "error": null
    }
  }
}
```

**List All Backends:**
```bash
curl http://localhost:9000/backends
```

---

## Tool Execution Flow

```
┌────────────────────────────────────────────────────┐
│ 1. User Query                                       │
│    "Search for diseases related to BRCA1"          │
└─────────────────┬──────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────┐
│ 2. Claude Decides to Call Tool                     │
│    biocontext-hub__search_diseases                 │
│    args: { query: "BRCA1", type: "disease" }      │
└─────────────────┬──────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────┐
│ 3. NulaLabs Routes to MCP Client                   │
│    session.callTool("search_diseases", args)       │
└─────────────────┬──────────────────────────────────┘
                  ▼ SSE Request
┌────────────────────────────────────────────────────┐
│ 4. Gateway Receives Call                           │
│    Routes to: biocontext-ai-knowledgebase-mcp      │
└─────────────────┬──────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────┐
│ 5. Backend Server Executes Tool                    │
│    Queries database → Returns results              │
└─────────────────┬──────────────────────────────────┘
                  ▼ SSE Response
┌────────────────────────────────────────────────────┐
│ 6. Gateway Returns Results to Client               │
└─────────────────┬──────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────┐
│ 7. Claude Processes Results                        │
│    Formats response for user                       │
└────────────────────────────────────────────────────┘
```

---

## Key Advantages of This Architecture

### 1. **Scalability**
- Add new servers without changing client code
- Gateway handles routing automatically

### 2. **Discoverability**
- `hub_list_servers` provides runtime tool discovery
- AI can learn about new tools dynamically

### 3. **Reliability**
- Graceful degradation: If one server fails, others continue
- Health monitoring catches issues early

### 4. **Maintainability**
- Centralized configuration in `mcp.json`
- Auto-deployment scripts reduce manual work

### 5. **Extensibility**
- Easy to add custom MCP servers
- Standard MCP protocol ensures compatibility

---

## Troubleshooting

### Gateway Not Connecting

**Check gateway logs:**
```bash
cd mcp-deployment
docker-compose logs mcp-gateway
```

**Common issues:**
- Port 9000 already in use
- Missing `mcp.json` configuration
- Server containers not running

### Tool Call Failures

**Check specific server logs:**
```bash
docker-compose logs biocontext-ai-knowledgebase-mcp
```

**Common issues:**
- Server not started
- Missing environment variables
- Invalid tool arguments

### Registry Updates Not Reflected

**Force rebuild:**
```bash
cd mcp-deployment
./scripts/deploy.sh --rebuild
```

---

## Future Enhancements

### 1. **Real-Time Registry Sync**
- WebSocket connection to BioContextAI registry
- Automatic updates when new servers published

### 2. **Tool Marketplace**
- Browse available tools via UI
- One-click server installation

### 3. **Usage Analytics**
- Track which tools are most popular
- Optimize server resource allocation

### 4. **Caching Layer**
- Cache frequently-called tool results
- Reduce latency and API costs

---

## Related Documentation

- [MCP Unified Approach](./MCP_UNIFIED_APPROACH.md) - Tool part normalization
- [BioContextAI Registry](https://biocontext.ai/registry) - Public server registry
- [MCP Deployment README](../mcp-deployment/README.md) - Deployment guide
- [MCP Hub README](../mcp-hub/README.md) - Gateway implementation details

---

**Last Updated**: 2025-01-24
