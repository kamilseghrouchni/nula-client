FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install the package globally
RUN uv tool install pharmacology-mcp

# Add uv tools to PATH
ENV PATH="/root/.local/bin:$PATH"

# Expose port
EXPOSE 8000

# Set environment
ENV MCP_ENVIRONMENT=PRODUCTION
ENV PORT=8000

# Run the server directly (executable installed in /root/.local/bin)
CMD ["pharmacology-mcp"]
