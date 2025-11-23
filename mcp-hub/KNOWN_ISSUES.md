# BioContextAI MCP Hub - Known Issues

This document tracks known issues with MCP servers in the BioContextAI registry.

## Server Compatibility Matrix

| Server | Status | Issue Category | Details |
|--------|--------|----------------|---------|
| sviatkh/flybase-mcp-server | ✅ Working | - | 2 tools |
| longevity-genie/opengenes-mcp | ✅ Working | - | 3 tools |
| tianqitang1/enrichr-mcp-server | ✅ Working | - | 2 tools |
| longevity-genie/gget-mcp | ✅ Working | - | 3 tools |
| cyanheads/pubchem-mcp-server | ✅ Working | - | 10 tools |
| scmcphub/scmcp | ✅ Working | - | 9 tools |
| genomoncology/biomcp | ✅ Working | - | 35 tools |
| longevity-genie/synergy-age-mcp | ✅ Working | - | 3 tools |
| longevity-genie/pharmacology-mcp | ✅ Working | - | 17 tools |
| grll/pubmedmcp | ✅ Working | - | 1 tools |
| not-a-feature/VEPmcp | ✅ Working | Warning | 9 tools (stdout warnings) |
| biocypher/biocypher-mcp | ✅ Working | Remote | 9 tools |
| PDBeurope/PDBe-MCP-Servers | ✅ Working | - | 14 tools |
| longevity-genie/biothings-mcp | ✅ Working | - | 19 tools |
| biocontext-ai/anndata-mcp | ✅ Working | - | 3 tools |
| cyanheads/clinicaltrialsgov-mcp-server | ✅ Working | - | 5 tools |
| biocontext-ai/knowledgebase-mcp | ✅ Working | - | 52 tools |
| biocontext-ai/nucleotide_archive_mcp | ✅ Working | - | 10 tools |
| biocontext-ai/skill-to-mcp | ✅ Working | - | 3 tools |
| meringlab/string-mcp | ✅ Working | Remote | 16 tools |
| saezlab/omnipath-next | ✅ Working | Remote | 1 tools |
| biocontext-ai/unofficial-cellosaurus-mcp | ✅ Working | - | 6 tools |
| Nexgene-Research/nexonco-mcp | ✅ Working | - | 1 tools |
| vrtejus/pymol-mcp | ❌ Failed | Upstream Bug | FastMCP API incompatibility |
| royerlab/napari-mcp | ❌ Failed | System Deps | Requires Qt (GUI) |
| jzinno/biomart-mcp | ❌ Failed | Runtime Deps | Missing pybiomart at runtime |
| mims-harvard/ToolUniverse | ❌ Failed | System Deps | Missing libXrender |

## Issue Categories

### Category A: Upstream MCP Server Bugs

These issues are in the MCP server code itself and need to be fixed by the maintainers.

#### vrtejus/pymol-mcp
- **Error**: `TypeError: FastMCP.__init__() got an unexpected keyword argument 'description'`
- **Cause**: Server uses old FastMCP API where `description` was a valid kwarg
- **Status**: Needs upstream fix
- **Workaround**: None - server incompatible with FastMCP 2.x

#### jzinno/biomart-mcp
- **Error**: `ModuleNotFoundError: No module named 'pybiomart'`
- **Cause**: Server config uses `uvx --with pybiomart python -c "..."` pattern
- **Status**: Runtime dependency not available in transformed command
- **Workaround**: Skip this server

### Category B: Missing System Libraries

These servers require system libraries not installed in the Docker image.

#### royerlab/napari-mcp
- **Error**: `QtBindingsNotFoundError: No Qt bindings could be found`
- **Cause**: Napari is a GUI application requiring Qt (PyQt5/PySide2)
- **Status**: **Not suitable for headless Docker** - requires display
- **Workaround**: Skip this server in Docker deployment

#### mims-harvard/ToolUniverse
- **Error**: `ImportError: libXrender.so.1: cannot open shared object file`
- **Cause**: RDKit requires X11 rendering libraries
- **Status**: Can be fixed by adding `libxrender1` to Dockerfile
- **Workaround**: Add `apt-get install libxrender1`

### Category C: Non-Blocking Warnings

These issues cause warnings but don't prevent the server from working.

#### not-a-feature/VEPmcp
- **Warning**: `Failed to parse JSONRPC message from server`
- **Cause**: Server prints startup messages to stdout before JSON-RPC
- **Status**: Works despite warnings (9 tools registered)
- **Workaround**: None needed

## Gateway Limitations

### **kwargs Tools Not Supported
- **Error**: `Functions with **kwargs are not supported as tools`
- **Cause**: FastMCP cannot register tools that use `**kwargs` in their signature
- **Status**: Gateway wraps registration in try/catch to skip problematic tools

## Adding New Servers

When adding new MCP servers to the registry, test for:

1. **FastMCP Version Compatibility**: Ensure server works with FastMCP 2.x
2. **Headless Operation**: Server must work without display/GUI
3. **System Dependencies**: Document any required system libraries
4. **Runtime Dependencies**: Test that `--with` dependencies are available

## Reporting Issues

- For upstream MCP server issues: Report to the respective GitHub repository
- For MCP Hub issues: Report to biocontext-ai/mcp-hub
