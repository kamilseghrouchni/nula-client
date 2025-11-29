# BioContextAI MCP Hub

A single Docker image providing access to **27+ BioContextAI MCP servers** and **230+ biomedical tools** through one unified SSE endpoint.

## Features

- **One Command Setup** - Run a single Docker container to access all biomedical MCP tools
- **Always Up-to-Date** - Fetches latest server list from BioContextAI registry on startup
- **Unified Interface** - Single SSE endpoint aggregates all tools from all servers
- **Smart Routing** - Automatic tool-to-server routing with prefixed namespacing
- **Build Summary** - Clear visibility into connected servers and any failures
- **Standard MCP Protocol** - Works with any MCP-compatible client (Claude Desktop, NulaLabs, etc.)

## Quick Start

### 1. Build and Run

```bash
# Build the Docker image
cd mcp-hub
docker build -t mcp-hub .

# Run the MCP Hub (first run installs all servers ~5-10 min)
docker run -p 9000:9000 mcp-hub

# Or skip installation for faster startup (uses on-demand loading)
docker run -p 9000:9000 -e SKIP_INSTALL=true mcp-hub
```

### 2. Verify It's Running

```bash
# Check the SSE endpoint
curl http://localhost:9000/sse
# Should return: event: endpoint, data: /messages/?session_id=...
```

### 3. Configure Your Client

Add to your `mcp-config.json`:

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

That's it! Your client now has access to 230+ biomedical tools.

## Available Servers & Tools

| Server | Tools | Description |
|--------|-------|-------------|
| **biocontext-ai/knowledgebase-mcp** | 52 | STRING, UniProt, Reactome, HPA, AlphaFold, KEGG |
| **genomoncology/biomcp** | 35 | Genomics and oncology tools |
| **longevity-genie/biothings-mcp** | 19 | MyGene.info, MyVariant.info, MyChem.info |
| **longevity-genie/pharmacology-mcp** | 17 | Guide to PHARMACOLOGY database |
| **meringlab/string-mcp** | 16 | Protein-protein interactions |
| **PDBeurope/PDBe-MCP-Servers** | 14 | Protein structure database |
| **cyanheads/pubchem-mcp-server** | 10 | Chemical compound data |
| **biocontext-ai/nucleotide_archive_mcp** | 10 | Nucleotide sequences |
| **not-a-feature/VEPmcp** | 9 | Variant effect predictor |
| **biocypher/biocypher-mcp** | 9 | Knowledge graph queries |
| **scmcphub/scmcp** | 9 | Single-cell analysis |
| **biocontext-ai/unofficial-cellosaurus-mcp** | 6 | Cell line database |
| **cyanheads/clinicaltrialsgov-mcp-server** | 5 | Clinical trials search |
| **longevity-genie/gget-mcp** | 3 | Bioinformatics toolkit |
| **longevity-genie/opengenes-mcp** | 3 | Longevity genes database |
| **longevity-genie/synergy-age-mcp** | 3 | Drug synergy for aging |
| **biocontext-ai/anndata-mcp** | 3 | AnnData file manipulation |
| **biocontext-ai/skill-to-mcp** | 3 | Skill execution |
| **tianqitang1/enrichr-mcp-server** | 2 | Gene set enrichment |
| **sviatkh/flybase-mcp-server** | 2 | Drosophila genetics |
| **grll/pubmedmcp** | 1 | PubMed literature search |
| **saezlab/omnipath-next** | 1 | Molecular interactions |
| **Nexgene-Research/nexonco-mcp** | 1 | Oncology research |

## Example Queries

### Basic Queries (Single Server)

```
# Literature Search
"Find recent papers on CRISPR gene therapy for sickle cell disease"

# Protein Interactions
"What proteins interact with TP53?"

# Compound Information
"Get compound information for metformin"

# Clinical Trials
"Find active clinical trials for Alzheimer's disease"

# Protein Data
"Get protein sequence and function for BRCA1"
```

### Multi-Step Analysis

```
# Gene Analysis Pipeline
"Analyze the gene EGFR: get its protein interactions from STRING,
find related pathways in KEGG and Reactome, and check for known variants"

# Drug Discovery
"I'm researching GLP-1 receptor agonists. Find the protein structure,
known compounds that bind to it, and any ongoing clinical trials"

# Variant Analysis
"What is the clinical significance of the BRAF V600E mutation?
Find related literature and current targeted therapies"
```

### Advanced Workflows

```
# Comparative Gene Analysis
"Compare TP53, BRCA1, EGFR in terms of:
- Protein interactions (STRING)
- Associated diseases (BioThings)
- Available drugs (Pharmacology)
- Literature count (PubMed)"

# Longevity Research
"What genes are associated with longevity? Check OpenGenes database,
find their protein interactions, and identify druggable targets"

# Cancer Genomics
"For PIK3CA: get mutation data, check protein structure impact,
find approved drugs, and list current clinical trials"
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Docker Container                          │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                   MCP Gateway (FastMCP)                  ││
│  │                                                          ││
│  │   • Aggregates tools from all servers                    ││
│  │   • Routes tool calls to correct backend                 ││
│  │   • Exposes unified SSE endpoint on port 9000            ││
│  │   • Provides build summary with connection status        ││
│  └────────┬─────────┬─────────┬─────────┬──────────────────┘│
│           │         │         │         │                    │
│      ┌────▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐              │
│      │PubMed  │ │UniProt│ │STRING │ │ ...   │              │
│      │(uvx)   │ │(uvx)  │ │(remote)│ │(27+)  │              │
│      └────────┘ └───────┘ └───────┘ └───────┘              │
│                                                               │
│  Pre-installed via: uv tool install / npm install -g         │
└──────────────────────────────────────────────────────────────┘
         │
         │ Port 9000 (SSE)
         ▼
┌──────────────────────────────────────────────────────────────┐
│                      Your MCP Client                          │
│                                                               │
│  Tools are namespaced by server:                              │
│  - biocontext_ai_knowledgebase_mcp__search_uniprot           │
│  - meringlab_string_mcp__get_interactions                    │
│  - grll_pubmedmcp__search                                    │
└──────────────────────────────────────────────────────────────┘
```

## How It Works

### On Startup

1. **Fetch Config** - Downloads latest `https://biocontext.ai/mcp.json`
2. **Install Servers** - Runs `uv tool install` for Python packages, `npm install -g` for Node.js
3. **Connect & Discover** - Gateway connects to each server and collects available tools
4. **Build Summary** - Prints status of all servers (connected/failed with reasons)
5. **Start Gateway** - Exposes unified SSE endpoint on port 9000

### Tool Routing

- Tools are prefixed with server name: `server_name__tool_name`
- Gateway maintains mapping of tools to backend servers
- Tool calls are routed to the appropriate server automatically

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_HUB_PORT` | `9000` | Port for the SSE endpoint |
| `MCP_CONFIG_URL` | `https://biocontext.ai/mcp.json` | URL to fetch server config |
| `MCP_CONFIG_PATH` | `/app/config/mcp.json` | Local path for config file |
| `SKIP_INSTALL` | `false` | Skip server installation (faster startup) |
| `INSTALL_SERVERS` | `true` | Enable/disable server installation |

## Built-in Tools

The gateway provides two built-in tools:

- **`hub_health`** - Check health status of all connected servers
- **`hub_list_servers`** - List all servers and their tools

## Development

### Build Locally

```bash
cd mcp-hub
docker build -t mcp-hub .
```

### Run with Custom Config

```bash
# Use local config file
docker run -p 9000:9000 \
  -v /path/to/my-mcp.json:/app/config/mcp.json \
  -e SKIP_INSTALL=true \
  mcp-hub
```

### Run Without Docker

```bash
# Install dependencies
pip install -r requirements.txt

# Fetch config
curl -o config/mcp.json https://biocontext.ai/mcp.json

# Install servers (optional, requires uv)
python install_servers.py config/mcp.json

# Start gateway
python gateway.py config/mcp.json
```

## Troubleshooting

### Check Status

```bash
# Check SSE endpoint
curl http://localhost:9000/sse

# View container logs
docker logs <container_id>

# Check running containers
docker ps
```

### Known Issues

Some servers may fail to connect due to:

| Issue | Affected Servers | Reason |
|-------|------------------|--------|
| GUI Required | napari-mcp | Requires Qt display |
| API Incompatible | pymol-mcp | Old FastMCP version |
| Missing Module | biomart-mcp | Runtime dependency issue |

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for full details.

### Memory Usage

Running all servers requires ~2-4GB RAM:

```bash
# Run with memory limit
docker run -p 9000:9000 --memory=4g mcp-hub
```

## Files

| File | Description |
|------|-------------|
| `Dockerfile` | Docker image definition |
| `gateway.py` | FastMCP gateway aggregating all servers |
| `install_servers.py` | Server installation script |
| `entrypoint.sh` | Container startup script |
| `requirements.txt` | Python dependencies |
| `KNOWN_ISSUES.md` | Server compatibility documentation |

## Related Projects

- [BioContextAI Registry](https://github.com/biocontext-ai/registry) - Official MCP server registry
- [BioContextAI](https://biocontext.ai) - Community hub for biomedical AI
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification

## License

Apache 2.0

## Citation

If this tool is useful for your research, please cite BioContextAI:

```bibtex
@article{BioContext_AI_Kuehl_Schaub_2025,
  title={BioContextAI is a community hub for agentic biomedical systems},
  journal={Nature Biotechnology},
  year={2025},
  doi={10.1038/s41587-025-02900-9}
}
```
