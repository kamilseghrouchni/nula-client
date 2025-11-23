# MCP Hub Interactive CLI Setup - TODO

**Status: Planned, not implemented yet**

## Goal
Create an interactive CLI tool (like Claude Code) that allows users to select which MCP servers to install before starting the Docker container.

## Planned Flow
```
$ python mcp-hub-setup.py

╭──────────────────────────────────────────────╮
│        BioContextAI MCP Hub Setup            │
╰──────────────────────────────────────────────╯

? How would you like to proceed?
  ❯ Install all servers (27 available)
    Select specific servers
    Select by category
    Quick start (remote servers only - no install)
    Exit

[If "Select specific servers":]

? Select servers (↑↓ navigate, space toggle, enter confirm):
  ❯ [x] biocontext-ai/knowledgebase-mcp  (21 tools)
    [ ] longevity-genie/gget-mcp         (12 tools)
    [x] meringlab/string-mcp             (16 tools)
    ...

Selected: 5 servers | Estimated tools: 60+

? Start MCP Hub? [Y/n]

Building Docker image...
Starting gateway on port 9000...
```

## Files to Create

1. **`cli.py`** - Main CLI entry point
   - Uses `rich` for beautiful terminal UI
   - Uses `questionary` or `InquirerPy` for interactive prompts
   - Fetches registry from biocontext.ai
   - Shows server list with tool counts
   - Writes selection to `selection.json`
   - Runs Docker with the selection

2. **`requirements-cli.txt`** - CLI dependencies
   - `rich`, `questionary`, `httpx`

## CLI Options
- `--all` - Install all servers (no prompt)
- `--quick` - Remote servers only (fastest)
- `--config FILE` - Use existing selection file
- `--port PORT` - Custom port (default 9000)

## Usage
```bash
# Interactive setup
python mcp-hub-setup.py

# Non-interactive options
python mcp-hub-setup.py --all
python mcp-hub-setup.py --quick
python mcp-hub-setup.py --config my-selection.json
```

---
*Come back to implement this after fixing Docker image issues*
