# BioContextAI MCP Hub
# Single Docker image providing access to all BioContextAI MCP servers
# via a unified SSE gateway endpoint

FROM python:3.12-slim AS base

# Install system dependencies
# Note: libxrender1 needed for RDKit (ToolUniverse), libxext6 for X11 support
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (for npx-based MCP servers)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY --from=ghcr.io/astral-sh/uv:latest /uvx /usr/local/bin/uvx

# Add uv tools to PATH (where installed tools go)
ENV PATH="/root/.local/bin:$PATH"
ENV UV_TOOL_BIN_DIR="/root/.local/bin"

# Set up working directory
WORKDIR /app

# Copy application files
COPY requirements.txt .
COPY install_servers.py .
COPY gateway.py .
COPY entrypoint.sh .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Install Python dependencies for the gateway
RUN uv pip install --system -r requirements.txt

# Create directory for MCP server configs
RUN mkdir -p /app/config

# Expose SSE port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV MCP_HUB_PORT=9000
ENV MCP_CONFIG_URL=https://biocontext.ai/mcp.json
ENV UV_SYSTEM_PYTHON=1

# Run entrypoint
ENTRYPOINT ["./entrypoint.sh"]
