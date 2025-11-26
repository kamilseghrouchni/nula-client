#!/usr/bin/env python3
"""
BioContextAI MCP Gateway
Aggregates multiple MCP servers into a single SSE endpoint.

This gateway:
1. Loads mcp.json configuration
2. Spawns STDIO servers as subprocesses
3. Proxies remote SSE/HTTP servers
4. Aggregates all tools into a unified interface
5. Exposes everything via SSE on port 9000
"""
import asyncio
import json
import os
import shutil
import signal
import sys
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from fastmcp import Client, FastMCP
from rich.console import Console

console = Console()

# Gateway configuration
GATEWAY_PORT = int(os.getenv("MCP_HUB_PORT", "9000"))
CONFIG_PATH = os.getenv("MCP_CONFIG_PATH", "/app/config/mcp.json")
UV_TOOL_BIN_DIR = os.getenv("UV_TOOL_BIN_DIR", "/root/.local/bin")


@dataclass
class ServerInfo:
    """Information about a connected MCP server."""

    name: str
    config: dict
    client: Client | None = None
    tools: list[dict] = field(default_factory=list)
    is_remote: bool = False
    is_connected: bool = False
    error: str | None = None


def transform_uvx_config(config: dict) -> dict:
    """
    Transform uvx configs to use installed binaries directly.

    When uv tool install is run, it creates executables in UV_TOOL_BIN_DIR.
    This function finds those binaries and updates the config to use them directly,
    bypassing uvx which may not work correctly in Docker.

    Patterns handled:
    - uvx package@latest → /root/.local/bin/package
    - uvx --from package command → /root/.local/bin/command
    - uvx --with deps package → uv tool run --with deps package (preserve deps!)
    - npx package → npx package (unchanged, npm handles caching)
    """
    command = config.get("command", "").lower()
    args = config.get("args", [])

    # Only transform uvx commands
    if command != "uvx":
        return config

    # Parse uvx args to find the binary to run
    from_package = None
    with_deps = []  # Preserve --with dependencies!
    positional_args = []
    remaining_args = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--from" and i + 1 < len(args):
            from_package = args[i + 1]
            i += 2
        elif arg == "--with" and i + 1 < len(args):
            # PRESERVE --with deps for runtime!
            with_deps.append(args[i + 1])
            i += 2
        elif arg.startswith("-"):
            # Keep other flags
            remaining_args.append(arg)
            i += 1
        else:
            positional_args.append(arg)
            i += 1

    # Determine the binary name to look for
    binary_name = None
    binary_args = []

    if from_package:
        # --from package command → command is the binary
        if positional_args:
            binary_name = positional_args[0]
            binary_args = positional_args[1:]
    elif positional_args:
        # package@latest or package subcommand → package is the binary
        first_arg = positional_args[0]
        # Remove version specifier
        binary_name = first_arg.split("@")[0]
        binary_args = positional_args[1:]

    if not binary_name:
        # Couldn't determine binary, return original config
        return config

    # If we have --with deps, we MUST use uv tool run to preserve them
    # The installed binary won't have access to these runtime deps
    if with_deps:
        console.print(f"    [dim]→ Using uv tool run (needs deps: {with_deps})[/dim]")
        new_config = config.copy()
        new_config["command"] = "uv"
        new_config["args"] = ["tool", "run"] + args  # Keep original args with --with
        return new_config

    # Look for the binary in UV_TOOL_BIN_DIR
    binary_path = Path(UV_TOOL_BIN_DIR) / binary_name

    # Also try common variations (underscores vs hyphens)
    variations = [
        binary_name,
        binary_name.replace("-", "_"),
        binary_name.replace("_", "-"),
    ]

    found_binary = None
    for var in variations:
        test_path = Path(UV_TOOL_BIN_DIR) / var
        if test_path.exists() and test_path.is_file():
            found_binary = str(test_path)
            break

    # Also check if it's in PATH
    if not found_binary:
        found_binary = shutil.which(binary_name)

    if found_binary:
        # Create transformed config using the installed binary
        new_config = config.copy()
        new_config["command"] = found_binary
        new_config["args"] = remaining_args + binary_args
        console.print(f"    [dim]→ Transformed: uvx → {found_binary}[/dim]")
        return new_config
    else:
        # Binary not found, try using uv tool run instead of uvx
        # uv tool run is more reliable than uvx in Docker
        console.print(f"    [yellow]→ Binary {binary_name} not found, using uv tool run[/yellow]")
        new_config = config.copy()
        new_config["command"] = "uv"
        new_config["args"] = ["tool", "run"] + args
        return new_config


class MCPGateway:
    """
    MCP Gateway that aggregates multiple MCP servers.

    Provides a unified interface to all tools from all connected servers.
    """

    def __init__(self, config_path: str):
        self.config_path = config_path
        self.servers: dict[str, ServerInfo] = {}
        self.tool_to_server: dict[str, str] = {}
        self.mcp = FastMCP("BioContextAI Hub")
        self._shutdown_event = asyncio.Event()

    def load_config(self) -> dict:
        """Load the mcp.json configuration file."""
        with open(self.config_path) as f:
            return json.load(f)

    async def connect_server(self, name: str, config: dict) -> ServerInfo:
        """Connect to a single MCP server."""
        # Transform uvx configs to use installed binaries
        transformed_config = transform_uvx_config(config)

        server_info = ServerInfo(
            name=name,
            config=transformed_config,
            is_remote="url" in config,
        )

        try:
            # Create client config in the format FastMCP expects
            client_config = {"mcpServers": {name: transformed_config}}
            client = Client(client_config)

            # Connect and fetch tools
            async with client:
                tools = await client.list_tools()
                server_info.tools = [
                    {
                        "name": getattr(t, "name", t.get("name") if isinstance(t, dict) else str(t)),
                        "description": getattr(t, "description", t.get("description", "") if isinstance(t, dict) else ""),
                        "inputSchema": getattr(t, "inputSchema", t.get("inputSchema") if isinstance(t, dict) else None),
                    }
                    for t in tools
                ]
                server_info.is_connected = True
                server_info.client = client

            console.print(f"  [green]✓[/green] {name}: {len(server_info.tools)} tools")

        except Exception as e:
            server_info.error = str(e)
            console.print(f"  [red]✗[/red] {name}: {e}")

        return server_info

    async def connect_all_servers(self):
        """Connect to all configured MCP servers."""
        console.print("\n[bold blue]Connecting to MCP servers...[/bold blue]\n")

        config = self.load_config()
        servers_config = config.get("mcpServers", {})

        console.print(f"[cyan]Found {len(servers_config)} servers in configuration[/cyan]\n")

        # Connect to servers concurrently with semaphore to limit parallelism
        semaphore = asyncio.Semaphore(5)

        async def connect_with_semaphore(name: str, cfg: dict) -> tuple[str, ServerInfo]:
            async with semaphore:
                return name, await self.connect_server(name, cfg)

        tasks = [connect_with_semaphore(name, cfg) for name, cfg in servers_config.items()]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        for result in results:
            if isinstance(result, Exception):
                console.print(f"[red]Error: {result}[/red]")
                continue
            name, server_info = result
            self.servers[name] = server_info

            # Build tool -> server mapping
            for tool in server_info.tools:
                tool_name = tool["name"]
                # Prefix with server name to avoid collisions
                prefixed_name = f"{name.replace('/', '_').replace('-', '_')}__{tool_name}"
                self.tool_to_server[prefixed_name] = name
                self.tool_to_server[tool_name] = name  # Also map unprefixed for convenience

        # Print summary
        connected = sum(1 for s in self.servers.values() if s.is_connected)
        total_tools = sum(len(s.tools) for s in self.servers.values())

        console.print(f"\n[bold]Connection Summary:[/bold]")
        console.print(f"  [green]Connected: {connected}/{len(servers_config)} servers[/green]")
        console.print(f"  [cyan]Total tools: {total_tools}[/cyan]")

    async def mount_proxy_servers(self):
        """
        Mount all connected backend servers as proxies to preserve their schemas.

        Uses FastMCP.from_client() to create proxy servers that automatically
        preserve the full tool schemas from backend servers.
        """
        console.print("\n[bold blue]Mounting backend servers as proxies...[/bold blue]\n")

        mounted_count = 0
        skipped_count = 0

        for server_name, server_info in self.servers.items():
            if not server_info.is_connected:
                console.print(f"  [yellow]⚠ Skipping {server_name} (not connected)[/yellow]")
                skipped_count += 1
                continue

            try:
                # Create a client config for this backend server
                client_config = {"mcpServers": {server_name: server_info.config}}
                client = Client(client_config)

                # Create a proxy server from the client
                # This preserves the backend server's tool schemas automatically!
                proxy_server = FastMCP.from_client(client, name=f"{server_name}_proxy")

                # Mount the proxy with the server name as prefix
                # This creates namespaced tool names like "server__tool"
                safe_server_name = server_name.replace("/", "_").replace("-", "_")
                self.mcp.mount(safe_server_name, proxy_server)

                console.print(f"  [green]✓[/green] Mounted {server_name} with {len(server_info.tools)} tools")
                mounted_count += 1

            except Exception as e:
                console.print(f"  [yellow]⚠ Failed to mount {server_name}: {e}[/yellow]")
                skipped_count += 1

        console.print(f"\n[green]Mounted {mounted_count} backend servers as proxies[/green]")
        if skipped_count > 0:
            console.print(f"[yellow]Skipped {skipped_count} servers[/yellow]")

    async def start(self):
        """Start the gateway server."""
        console.print(f"\n[bold green]Starting MCP Hub Gateway on port {GATEWAY_PORT}...[/bold green]\n")

        # Connect to all servers
        await self.connect_all_servers()

        # Mount backend servers as proxies (preserves schemas!)
        await self.mount_proxy_servers()

        # Add health check endpoint
        @self.mcp.tool(name="hub_health", description="Check the health of the MCP Hub")
        async def health_check() -> dict:
            """Return health status of all connected servers."""
            return {
                "status": "healthy",
                "servers": {
                    name: {
                        "connected": info.is_connected,
                        "tools": len(info.tools),
                        "error": info.error,
                    }
                    for name, info in self.servers.items()
                },
            }

        # Add list servers endpoint
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

        # Print final build summary
        self._print_build_summary()

        # Run the server
        console.print(f"\n[bold]Gateway ready at http://0.0.0.0:{GATEWAY_PORT}/sse[/bold]")
        console.print("[dim]Press Ctrl+C to stop[/dim]\n")

        # Run FastMCP server
        await self.mcp.run_sse_async(host="0.0.0.0", port=GATEWAY_PORT)

    def _print_build_summary(self):
        """Print a comprehensive build summary with all connection results."""
        console.print("\n" + "=" * 60)
        console.print("[bold cyan]BioContextAI MCP Hub - Build Summary[/bold cyan]")
        console.print("=" * 60)

        # Categorize servers
        connected = []
        failed = []
        remote = []

        for name, info in self.servers.items():
            if info.is_connected:
                connected.append((name, len(info.tools)))
                if info.is_remote:
                    remote.append(name)
            else:
                failed.append((name, info.error or "Unknown error"))

        # Summary stats
        total_tools = sum(len(s.tools) for s in self.servers.values() if s.is_connected)

        console.print(f"\n[bold]Status:[/bold]")
        console.print(f"  [green]✓ Connected:[/green] {len(connected)}/{len(self.servers)} servers")
        console.print(f"  [cyan]✓ Total tools:[/cyan] {total_tools}")
        if remote:
            console.print(f"  [blue]→ Remote servers:[/blue] {len(remote)}")

        # Connected servers
        if connected:
            console.print(f"\n[bold green]Connected Servers ({len(connected)}):[/bold green]")
            for name, tool_count in sorted(connected, key=lambda x: -x[1]):
                marker = "[blue]R[/blue]" if name in remote else "[green]L[/green]"
                console.print(f"  {marker} {name}: {tool_count} tools")

        # Failed servers with reasons
        if failed:
            console.print(f"\n[bold red]Failed Servers ({len(failed)}):[/bold red]")
            for name, error in failed:
                # Categorize the error
                if "Qt" in error or "display" in error.lower():
                    category = "[yellow]GUI Required[/yellow]"
                elif "libX" in error or "shared object" in error:
                    category = "[yellow]Missing Lib[/yellow]"
                elif "ModuleNotFoundError" in error:
                    category = "[yellow]Missing Module[/yellow]"
                elif "unexpected keyword" in error or "TypeError" in error:
                    category = "[yellow]API Incompatible[/yellow]"
                elif "Connection closed" in error:
                    category = "[red]Crash[/red]"
                else:
                    category = "[red]Error[/red]"

                console.print(f"  ✗ {name}")
                console.print(f"    {category}: {error[:80]}{'...' if len(error) > 80 else ''}")

        console.print("\n" + "=" * 60)

    async def shutdown(self):
        """Gracefully shutdown the gateway."""
        console.print("\n[yellow]Shutting down gateway...[/yellow]")
        self._shutdown_event.set()


async def main():
    """Main entry point."""
    config_path = sys.argv[1] if len(sys.argv) > 1 else CONFIG_PATH

    if not Path(config_path).exists():
        console.print(f"[red]Config file not found: {config_path}[/red]")
        console.print("[yellow]Tip: Set MCP_CONFIG_PATH or provide path as argument[/yellow]")
        sys.exit(1)

    gateway = MCPGateway(config_path)

    # Handle shutdown signals
    loop = asyncio.get_event_loop()

    def signal_handler():
        asyncio.create_task(gateway.shutdown())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    try:
        await gateway.start()
    except KeyboardInterrupt:
        await gateway.shutdown()
    except Exception as e:
        console.print(f"[red]Gateway error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
