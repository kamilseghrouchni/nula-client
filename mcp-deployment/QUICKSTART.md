# Quick Start Guide

Get all BioContextAI MCP servers running in 3 minutes!

## Step 1: Navigate to Directory

```bash
cd mcp-deployment
```

## Step 2: Configure Selection (Optional)

Edit which servers you want to install:

```bash
# The default selection.yaml includes 5 popular servers
# To customize, edit:
nano config/selection.yaml
```

**Default servers:**
- BioContextAI Knowledgebase MCP
- biothings-mcp
- gget-mcp
- ClinicalTrials.gov MCP
- PubMed MCP

## Step 3: Deploy

```bash
./scripts/deploy.sh
```

This command will:
1. ✓ Fetch latest registry (46+ servers)
2. ✓ Extract MCP configurations
3. ✓ Generate Docker Compose setup
4. ✓ Build Docker images
5. ✓ Start all services
6. ✓ Launch MCP Gateway

**Wait time:** ~5-10 minutes for first build

## Step 4: Verify

```bash
# Check gateway health
curl http://localhost:9000/health

# List available backends
curl http://localhost:9000/backends

# Gateway info
curl http://localhost:9000/
```

## Step 5: Connect NulaLabs Client

Generate the MCP config for your client:

```bash
.venv/bin/python scripts/generate-nula-config.py --mode gateway --output ../mcp-config.json
```

This creates/updates `mcp-config.json` in your nula-client directory with:

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

## Step 6: Use in NulaLabs

1. **Restart your NulaLabs dev server** (if running)
2. **Navigate to** http://localhost:3001/chat
3. **Ask the AI** to use biomedical tools:

Example queries:
- "Search for recent publications about BRCA1"
- "Get protein information for TP53"
- "Find clinical trials for Alzheimer's disease"
- "Show me pathway information for glycolysis"

The AI will now have access to all tools from all connected MCP servers!

## Management Commands

```bash
# Stop all services
./scripts/deploy.sh --stop

# Check for updates
./scripts/deploy.sh --check-updates

# Rebuild everything
./scripts/deploy.sh --rebuild

# View logs
docker-compose logs -f

# View specific server logs
docker-compose logs -f biocontext-ai-knowledgebase-mcp

# Restart a service
docker-compose restart biocontext-ai-knowledgebase-mcp
```

## Customization

### Add More Servers

Edit `config/selection.yaml`:

```yaml
servers:
  - biocontext-ai/knowledgebase-mcp
  - longevity-genie/gget-mcp
  - galaxyproject/galaxy-mcp          # Add this
  - saezlab/omnipath-next-mcp         # And this
```

Then rebuild:

```bash
./scripts/deploy.sh --rebuild
```

### Select by Category

```yaml
strategy: "category"
categories:
  - genomics
  - proteomics
  - clinical
```

### Install All Servers (Warning: Resource Intensive!)

```yaml
strategy: "all"
max_servers: 0  # No limit
```

## Troubleshooting

### Port Conflicts

Change port range in `config/selection.yaml`:

```yaml
port_range:
  start: 8100
  end: 8199
```

### Service Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Restart
docker-compose restart [service-name]

# Rebuild
docker-compose up -d --build [service-name]
```

### Low Memory

Reduce number of servers or increase resource limits:

```yaml
max_servers: 5  # Limit to 5 servers

resource_limits:
  default:
    cpu: "0.5"      # Lower CPU
    memory: "512M"  # Lower memory
```

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore [config/selection.yaml.example](config/selection.yaml.example) for all options
- Check the [BioContextAI Registry](https://biocontext.ai/registry) for available servers
- Join the [BioContextAI Community](https://biocontext.ai/community) for support

---

**That's it! You now have access to 46+ biomedical MCP servers through a single gateway!** 🎉
