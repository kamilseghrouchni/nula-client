# BioContextAI MCP Auto-Deployment System

**Automatically deploy all MCP servers from the BioContextAI registry with a single command.**

This system fetches all available MCP servers from the [BioContextAI Registry](https://biocontext.ai/registry), extracts their configurations, and generates a complete Docker Compose setup with a unified MCP gateway.

## Features

✨ **Automated Discovery** - Fetches all 46+ MCP servers from BioContextAI registry
🔧 **Smart Configuration** - Auto-extracts MCP configs from repository READMEs
📦 **Docker-Based** - Complete containerization with Docker Compose
🌐 **Unified Gateway** - Single entry point for all MCP servers
⚙️ **Configurable Selection** - Choose which servers to install via YAML
🔄 **Auto-Updates** - Check for new servers on startup
📊 **Resource Management** - Set CPU/memory limits per server
🏥 **Health Checks** - Built-in monitoring and health endpoints

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     NulaLabs Client                          │
│                 (http://localhost:3001)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCP Gateway                              │
│                 (http://localhost:9000)                      │
└─────────┬──────────┬──────────┬──────────┬─────────────────┘
          │          │          │          │
    ┌─────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐
    │biocontext│ │biothings│ │ gget  │ │clinical│
    │  :8000  │ │  :8001 │ │ :8002 │ │ :8003 │
    └─────────┘ └────────┘ └────────┘ └────────┘
```

## Quick Start

### Prerequisites

- Python 3.12+
- Docker & Docker Compose
- 4GB+ RAM recommended

### Installation

1. **Navigate to deployment directory:**
   ```bash
   cd mcp-deployment
   ```

2. **Configure server selection:**
   ```bash
   cp config/selection.yaml.example config/selection.yaml
   # Edit selection.yaml to choose which servers to install
   ```

3. **Deploy:**
   ```bash
   ./scripts/deploy.sh
   ```

That's it! The system will:
- Fetch the latest registry
- Extract MCP configurations
- Generate Docker Compose setup
- Build and start all services
- Launch the unified gateway

### Access

- **MCP Gateway:** http://localhost:9000/mcp
- **Gateway Health:** http://localhost:9000/health
- **Gateway Backends:** http://localhost:9000/backends

## Configuration

### Server Selection (`config/selection.yaml`)

Choose which servers to install:

```yaml
# Select specific servers
strategy: "specific"
servers:
  - biocontext-ai/knowledgebase-mcp
  - longevity-genie/gget-mcp
  - cyanheads/clinicaltrialsgov-mcp-server

# Or select by category
strategy: "category"
categories:
  - genomics
  - proteomics

# Or select by tags
strategy: "tags"
tags:
  - protein-protein interaction
  - drug discovery

# Or install all (resource-intensive!)
strategy: "all"
```

### Resource Limits

Control resource usage per server:

```yaml
resource_limits:
  default:
    cpu: "1.0"
    memory: "1G"

  overrides:
    biocontext-ai/knowledgebase-mcp:
      cpu: "2.0"
      memory: "2G"
```

### Environment Variables

Set global or per-server environment variables:

```yaml
env_vars:
  LOG_LEVEL: "info"

server_env_vars:
  galaxyproject/galaxy-mcp:
    GALAXY_API_KEY: "${GALAXY_API_KEY}"
```

## Available Servers

The system can deploy all 46+ servers from the BioContextAI registry:

| Category | Servers |
|----------|---------|
| **Knowledge Bases** | BioContext KB, BioThings, Omnipath |
| **Genomics** | gget, Ensembl, Galaxy, BioMart |
| **Proteomics** | UniProt, PDBe, AlphaFold, PyMOL |
| **Literature** | PubMed, bioRxiv, EuropePMC |
| **Clinical** | ClinicalTrials.gov, AACT |
| **Pathways** | Reactome, STRING, KEGG |
| **Single-Cell** | SCMCP, anndata |
| **And more...** | 30+ additional servers |

**Server Types:**
- 33 Python (uvx)
- 8 Node.js (npx)
- 3 Remote HTTP
- 1 Bun (bunx)
- 1 Direct Node

## Scripts

### 1. `fetch-registry.py`
Fetches the latest server list from BioContextAI registry.

```bash
.venv/bin/python scripts/fetch-registry.py
```

**Output:** `config/registry-cache.json`

### 2. `extract-configs.py`
Extracts MCP configurations from server repositories.

```bash
# Extract all
.venv/bin/python scripts/extract-configs.py

# Extract with LLM fallback (requires ANTHROPIC_API_KEY)
.venv/bin/python scripts/extract-configs.py --use-llm

# Limit to first N servers
.venv/bin/python scripts/extract-configs.py --limit 10
```

**Output:** `config/mcp-configs.json`

### 3. `generate-compose.py`
Generates Docker Compose configuration from selection.

```bash
.venv/bin/python scripts/generate-compose.py
```

**Output:**
- `docker-compose.yml`
- `servers/*/Dockerfile`
- `.env.example`

### 4. `deploy.sh`
Main deployment script - runs everything.

```bash
# Full deployment
./scripts/deploy.sh

# Check for registry updates
./scripts/deploy.sh --check-updates

# Force rebuild
./scripts/deploy.sh --rebuild

# Stop all services
./scripts/deploy.sh --stop
```

### 5. `generate-nula-config.py`
Generates `mcp-config.json` for NulaLabs client.

```bash
# Gateway mode (single endpoint)
.venv/bin/python scripts/generate-nula-config.py --mode gateway

# Direct mode (individual servers)
.venv/bin/python scripts/generate-nula-config.py --mode direct

# Both (gateway + individual)
.venv/bin/python scripts/generate-nula-config.py --mode both

# Merge with existing config
.venv/bin/python scripts/generate-nula-config.py --mode gateway --merge
```

## Integration with NulaLabs

### Option 1: Gateway Mode (Recommended)

Connect via single unified endpoint:

```json
{
  "mcpServers": {
    "biocontext-gateway": {
      "transport": "http",
      "url": "http://localhost:9000/mcp"
    }
  }
}
```

**Advantages:**
- Single connection
- Automatic load balancing
- Centralized health checks
- Easier management

### Option 2: Direct Mode

Connect to each server individually:

```json
{
  "mcpServers": {
    "biocontext-ai-knowledgebase-mcp": {
      "transport": "http",
      "url": "http://localhost:8000/mcp"
    },
    "longevity-genie-biothings-mcp": {
      "transport": "http",
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

**Advantages:**
- Fine-grained control
- Direct server access
- Simpler debugging

### Auto-Generation

Run `generate-nula-config.py` to automatically create `mcp-config.json`:

```bash
.venv/bin/python scripts/generate-nula-config.py --mode gateway --output ../mcp-config.json
```

## Management

### View Running Services

```bash
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f biocontext-ai-knowledgebase-mcp

# Gateway only
docker-compose logs -f mcp-gateway
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart biocontext-ai-knowledgebase-mcp
```

### Stop Services

```bash
./scripts/deploy.sh --stop
# OR
docker-compose down
```

### Update to Latest Servers

```bash
./scripts/deploy.sh --check-updates
```

## Troubleshooting

### Port Already in Use

Edit `config/selection.yaml`:

```yaml
port_range:
  start: 8100  # Change to different range
  end: 8199
```

Then rebuild:

```bash
./scripts/deploy.sh --rebuild
```

### Server Won't Start

Check logs:

```bash
docker-compose logs [service-name]
```

Common issues:
- Missing API keys (check `.env`)
- Port conflicts
- Resource limits too low

### Gateway Not Responding

1. Check gateway health:
   ```bash
   curl http://localhost:9000/health
   ```

2. Check gateway logs:
   ```bash
   docker-compose logs mcp-gateway
   ```

3. Verify backends:
   ```bash
   curl http://localhost:9000/backends
   ```

## Advanced

### Custom Dockerfiles

Override auto-generated Dockerfiles in `servers/[service-name]/Dockerfile`.

### Custom Port Mapping

Edit `docker-compose.yml` manually or adjust in `selection.yaml`.

### Resource Monitoring

Add Prometheus + Grafana:

```yaml
advanced:
  enable_metrics: true
```

### Centralized Logging

Enable ELK stack:

```yaml
advanced:
  enable_logging: true
```

## Directory Structure

```
mcp-deployment/
├── scripts/
│   ├── fetch-registry.py          # Fetch BioContextAI registry
│   ├── extract-configs.py         # Extract MCP configs
│   ├── generate-compose.py        # Generate docker-compose.yml
│   ├── generate-nula-config.py    # Generate NulaLabs config
│   ├── deploy.sh                  # Main deployment script
│   └── requirements.txt           # Python dependencies
├── config/
│   ├── selection.yaml             # Your server selection
│   ├── selection.yaml.example     # Selection template
│   ├── registry-cache.json        # Cached registry (auto-generated)
│   └── mcp-configs.json           # Extracted configs (auto-generated)
├── servers/                       # Auto-generated server Dockerfiles
│   ├── biocontext-ai-knowledgebase-mcp/
│   ├── longevity-genie-biothings-mcp/
│   └── ...
├── gateway/
│   ├── gateway.py                 # MCP gateway server
│   ├── Dockerfile                 # Gateway container
│   └── requirements.txt           # Gateway dependencies
├── docker-compose.yml             # Generated compose file
├── .env.example                   # Environment template
├── .env                           # Your environment (create this)
└── README.md                      # This file
```

## Contributing

Contributions welcome! This is an open-source project for the biomedical research community.

## License

Apache 2.0

## Acknowledgments

- [BioContextAI](https://biocontext.ai) - Registry and community hub
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- All MCP server maintainers in the BioContextAI registry

## Related Projects

- [BioContextAI Registry](https://github.com/biocontext-ai/registry)
- [BioContextAI Knowledgebase MCP](https://github.com/biocontext-ai/knowledgebase-mcp)
- [NulaLabs](https://github.com/kamilseghrouchni/nula-client) - AI-powered metabolomics analysis platform

---

**Built with ❤️ for the biomedical research community**
