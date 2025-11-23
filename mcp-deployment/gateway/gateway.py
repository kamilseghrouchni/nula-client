#!/usr/bin/env python3
"""
MCP Gateway Server
Unified entry point for all MCP servers
Routes requests to appropriate backend servers
"""
import os
import json
import httpx
import asyncio
from typing import Dict, List, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn


app = FastAPI(title="MCP Gateway", version="1.0.0")

# Configuration
GATEWAY_PORT = int(os.getenv("GATEWAY_PORT", "9000"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

# Backend server registry
# Format: {"server-name": {"url": "http://...", "transport": "http"}}
BACKENDS: Dict[str, Dict] = {}


def load_backend_config():
    """Load backend server configuration from environment or config file"""
    # Remote servers - using SSE transport URLs
    BACKENDS["biocontext-ai-knowledgebase-mcp"] = {
        "url": "https://mcp.biocontext.ai/sse",
        "transport": "sse"
    }
    BACKENDS["longevity-genie-biothings-mcp"] = {
        "url": "https://biothings-mcp.longevity-genie.info/sse",
        "transport": "sse"
    }
    BACKENDS["longevity-genie-gget-mcp"] = {
        "url": "https://gget-mcp.longevity-genie.info/sse",
        "transport": "sse"
    }
    BACKENDS["longevity-genie-opengenes-mcp"] = {
        "url": "https://opengenes-mcp.longevity-genie.info/sse",
        "transport": "sse"
    }
    BACKENDS["longevity-genie-synergy-age-mcp"] = {
        "url": "https://synergy-age-mcp.longevity-genie.info/sse",
        "transport": "sse"
    }
    BACKENDS["meringlab-string-mcp"] = {
        "url": "https://mcp.string-db.org/sse",
        "transport": "sse"
    }
    BACKENDS["saezlab-omnipath-next"] = {
        "url": "https://explore.omnipathdb.org/api/sse",
        "transport": "sse"
    }
    BACKENDS["biocontext-ai-unofficial-cellosaurus-mcp"] = {
        "url": "https://unofficial-cellosaurus-mcp.fastmcp.app/sse",
        "transport": "sse"
    }


def get_backend_for_tool(tool_name: str) -> Optional[Dict]:
    """Determine which backend handles a given tool"""
    # Tool names are typically prefixed with server name
    # e.g., "biocontext_kb__get_protein" -> biocontext-ai-knowledgebase-mcp

    for backend_name, backend_config in BACKENDS.items():
        # Check if tool name starts with backend identifier
        backend_id = backend_name.replace("-", "_")
        if tool_name.startswith(backend_id):
            return backend_config

    # Fallback: check all backends
    return None


@app.on_event("startup")
async def startup_event():
    """Initialize gateway on startup"""
    load_backend_config()
    print(f"🚀 MCP Gateway started on port {GATEWAY_PORT}")
    print(f"📡 Registered {len(BACKENDS)} backend servers:")
    for name, config in BACKENDS.items():
        print(f"  - {name}: {config['url']}")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check backend health
    healthy_backends = []
    unhealthy_backends = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        for name, config in BACKENDS.items():
            try:
                health_url = f"{config['url']}/health"
                response = await client.get(health_url)
                if response.status_code == 200:
                    healthy_backends.append(name)
                else:
                    unhealthy_backends.append(name)
            except:
                unhealthy_backends.append(name)

    status = "healthy" if len(unhealthy_backends) == 0 else "degraded"

    return {
        "status": status,
        "backends": {
            "total": len(BACKENDS),
            "healthy": len(healthy_backends),
            "unhealthy": len(unhealthy_backends)
        },
        "healthy_backends": healthy_backends,
        "unhealthy_backends": unhealthy_backends
    }


@app.get("/backends")
async def list_backends():
    """List all registered backend servers"""
    return {
        "backends": list(BACKENDS.keys()),
        "count": len(BACKENDS)
    }


@app.post("/mcp/tools/list")
async def list_tools():
    """List all available tools from all backends"""
    all_tools = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for name, config in BACKENDS.items():
            try:
                tools_url = f"{config['url']}/mcp/tools/list"
                response = await client.post(tools_url)
                if response.status_code == 200:
                    backend_tools = response.json().get("tools", [])
                    all_tools.extend(backend_tools)
            except Exception as e:
                print(f"Error fetching tools from {name}: {e}")

    return {"tools": all_tools}


@app.post("/mcp/tools/call")
async def call_tool(request: Request):
    """Route tool call to appropriate backend"""
    body = await request.json()
    tool_name = body.get("name")

    if not tool_name:
        raise HTTPException(status_code=400, detail="Missing tool name")

    # Find backend for this tool
    backend = get_backend_for_tool(tool_name)

    if not backend:
        # Try all backends (fallback)
        async with httpx.AsyncClient(timeout=60.0) as client:
            for name, config in BACKENDS.items():
                try:
                    call_url = f"{config['url']}/mcp/tools/call"
                    response = await client.post(call_url, json=body)
                    if response.status_code == 200:
                        return response.json()
                except:
                    continue

        raise HTTPException(status_code=404, detail=f"No backend found for tool: {tool_name}")

    # Forward request to backend
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            call_url = f"{backend['url']}/mcp/tools/call"
            response = await client.post(call_url, json=body)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Backend error: {str(e)}")


@app.post("/mcp")
@app.post("/mcp/")
async def mcp_endpoint(request: Request):
    """Generic MCP endpoint - routes to appropriate backend"""
    body = await request.json()
    method = body.get("method")

    if method == "tools/list":
        return await list_tools()
    elif method == "tools/call":
        return await call_tool(request)
    else:
        # Forward to all backends and merge results
        results = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            for name, config in BACKENDS.items():
                try:
                    mcp_url = f"{config['url']}/mcp"
                    response = await client.post(mcp_url, json=body)
                    if response.status_code == 200:
                        results.append(response.json())
                except:
                    continue

        if len(results) == 0:
            raise HTTPException(status_code=500, detail="No backend responded")

        return results[0] if len(results) == 1 else results


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "MCP Gateway",
        "version": "1.0.0",
        "backends": len(BACKENDS),
        "endpoints": {
            "health": "/health",
            "backends": "/backends",
            "mcp": "/mcp",
            "tools_list": "/mcp/tools/list",
            "tools_call": "/mcp/tools/call"
        }
    }


def main():
    """Run the gateway server"""
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=GATEWAY_PORT,
        log_level=LOG_LEVEL.lower()
    )


if __name__ == "__main__":
    main()
