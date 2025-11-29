#!/bin/bash
# BioContextAI MCP Hub Entrypoint
# Fetches latest config, installs servers, and starts the gateway

set -e

echo "=========================================="
echo "  BioContextAI MCP Hub"
echo "=========================================="
echo ""

# Configuration
CONFIG_URL="${MCP_CONFIG_URL:-https://biocontext.ai/mcp.json}"
CONFIG_PATH="${MCP_CONFIG_PATH:-/app/config/mcp.json}"
INSTALL_SERVERS="${INSTALL_SERVERS:-true}"
SKIP_INSTALL="${SKIP_INSTALL:-false}"

# Step 1: Fetch latest mcp.json
echo "[1/3] Fetching latest MCP configuration..."
echo "      URL: $CONFIG_URL"

if curl -sSf "$CONFIG_URL" -o "$CONFIG_PATH"; then
    SERVER_COUNT=$(python3 -c "import json; print(len(json.load(open('$CONFIG_PATH')).get('mcpServers', {})))")
    echo "      ✓ Downloaded configuration with $SERVER_COUNT servers"
else
    echo "      ✗ Failed to fetch configuration"
    if [ -f "$CONFIG_PATH" ]; then
        echo "      → Using cached configuration"
    else
        echo "      ✗ No cached configuration available, exiting"
        exit 1
    fi
fi
echo ""

# Step 2: Install MCP servers (optional, can be skipped if pre-installed)
if [ "$SKIP_INSTALL" = "true" ]; then
    echo "[2/3] Skipping server installation (SKIP_INSTALL=true)"
elif [ "$INSTALL_SERVERS" = "true" ]; then
    echo "[2/3] Installing MCP servers..."
    python3 /app/install_servers.py "$CONFIG_PATH" || {
        echo "      ⚠ Some servers failed to install, continuing anyway..."
    }
else
    echo "[2/3] Server installation disabled (INSTALL_SERVERS=false)"
fi
echo ""

# Step 3: Start the gateway
echo "[3/3] Starting MCP Gateway..."
echo "      Port: ${MCP_HUB_PORT:-9000}"
echo "      Config: $CONFIG_PATH"
echo ""

exec python3 /app/gateway.py "$CONFIG_PATH"
