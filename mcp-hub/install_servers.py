#!/usr/bin/env python3
"""
BioContextAI MCP Server Installer
Parses mcp.json and installs all MCP servers using uvx/npm
"""
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()


def parse_mcp_config(config_path: str) -> dict[str, Any]:
    """Load and parse the mcp.json configuration file."""
    with open(config_path) as f:
        return json.load(f)


def extract_package_info(server_name: str, config: dict) -> dict | None:
    """
    Extract package information from server config.

    Returns dict with:
        - type: 'uvx' | 'npx' | 'uv' | 'remote' | 'unknown'
        - package: package name to install (if applicable)
        - args: full args list for the command
        - url: remote URL (if applicable)

    uvx patterns handled:
        ["package@latest"] or ["package"] → install package
        ["--from", "package", "command"] → install from source
        ["--from", "git+url", "--with", "dep", "command"] → git source
        ["--with", "dep", "package"] → package with deps (package is LAST positional)
        ["package", "subcommand"] → package with subcommand
    """
    if "url" in config:
        return {"type": "remote", "url": config["url"]}

    command = config.get("command", "").lower()
    args = config.get("args", [])

    if command == "uvx":
        # Parse uvx args to find the main package
        # Need to handle: --from, --with, and positional args
        package = None
        from_package = None
        with_deps = []
        positional_args = []

        i = 0
        while i < len(args):
            arg = args[i]
            if arg == "--from" and i + 1 < len(args):
                from_package = args[i + 1]
                i += 2
            elif arg == "--with" and i + 1 < len(args):
                with_deps.append(args[i + 1])
                i += 2
            elif arg.startswith("-"):
                i += 1  # Skip other flags
            else:
                positional_args.append(arg)
                i += 1

        # Determine the package to install
        if from_package:
            # --from specifies the source package
            package = from_package
        elif positional_args:
            # First positional arg that looks like a package (not a subcommand)
            # Package names usually have letters/numbers/underscores/hyphens
            # Subcommands are usually simple words like "run", "stdio", "python"
            for pos_arg in positional_args:
                # Skip common subcommands
                if pos_arg in ("run", "stdio", "python", "-c"):
                    continue
                # Skip Python code snippets
                if pos_arg.startswith("import ") or ";" in pos_arg:
                    continue
                package = pos_arg
                break

        if package:
            # Clean up package name (remove @latest, etc. for install)
            clean_package = package.split("@")[0] if "@" in package else package
            # Handle git+ URLs
            if package.startswith("git+"):
                clean_package = package

            return {
                "type": "uvx",
                "package": clean_package,
                "full_package": package,
                "with_deps": with_deps,
                "args": args,
            }
        else:
            # Some uvx configs just run python with --with deps (like vrtejus/pymol-mcp)
            if with_deps:
                return {
                    "type": "uvx_deps_only",
                    "with_deps": with_deps,
                    "args": args,
                }

    elif command == "npx":
        # npx packages: extract package name
        # Common patterns:
        # ["-y", "package@latest"]
        # ["package"]
        # ["mcp-remote", "url"] - special case for remote proxy
        package = None
        for arg in args:
            if not arg.startswith("-") and arg != "-y":
                package = arg
                break

        if package:
            return {
                "type": "npx",
                "package": package,
                "args": args,
            }

    elif command == "uv":
        # uv run commands: need to install dependencies
        # ["run", "--with", "package", "command"]
        packages = []
        i = 0
        while i < len(args):
            if args[i] == "--with" and i + 1 < len(args):
                packages.append(args[i + 1])
                i += 2
            else:
                i += 1

        return {
            "type": "uv",
            "packages": packages,
            "args": args,
        }

    return {"type": "unknown", "config": config}


def install_uvx_package(package: str, full_package: str, with_deps: list[str] | None = None) -> tuple[bool, str]:
    """
    Install a uvx package using uv tool install.

    Returns (success, error_message)
    """
    try:
        # Build install command
        cmd = ["uv", "tool", "install", full_package]

        # Add --with dependencies if any
        if with_deps:
            for dep in with_deps:
                cmd.extend(["--with", dep])

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        output = result.stdout + result.stderr
        output_lower = output.lower()

        # Check for actual success indicators even if returncode != 0
        # uv outputs progress to stderr even on success
        success_indicators = [
            "installed",           # "Installed X packages"
            "packages in",         # "Installed 104 packages in 21ms"
            "already installed",   # Tool already exists
            "is already installed",
            "nothing to do",       # Already up to date
        ]

        # Check for actual error indicators (must be specific to avoid false positives)
        error_indicators = [
            "error: ",             # uv error prefix (note the space)
            "failed to resolve",   # Resolution failure
            "no solution found",   # Dependency conflict
            "could not find a version", # Package not found
            "package not found",
        ]

        has_success = any(ind in output_lower for ind in success_indicators)
        has_error = any(ind in output_lower for ind in error_indicators)

        if result.returncode == 0 or (has_success and not has_error):
            return True, ""
        else:
            # Extract meaningful error message
            error_msg = result.stderr.strip() or result.stdout.strip()
            # Truncate long errors
            if len(error_msg) > 200:
                error_msg = error_msg[:200] + "..."
            return False, error_msg

    except subprocess.TimeoutExpired:
        return False, "Installation timed out (>5 min)"
    except FileNotFoundError:
        return False, "uv command not found"
    except Exception as e:
        return False, str(e)


def install_npx_package(package: str) -> tuple[bool, str]:
    """
    Pre-fetch an npm package for npx usage.

    Returns (success, error_message)
    """
    try:
        result = subprocess.run(
            ["npm", "install", "-g", package],
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode == 0:
            return True, ""
        else:
            error_msg = result.stderr.strip() or result.stdout.strip()
            if len(error_msg) > 200:
                error_msg = error_msg[:200] + "..."
            return False, error_msg

    except subprocess.TimeoutExpired:
        return False, "Installation timed out (>5 min)"
    except FileNotFoundError:
        return False, "npm command not found"
    except Exception as e:
        return False, str(e)


def install_uv_packages(packages: list[str]) -> tuple[bool, str]:
    """
    Install uv packages using pip.

    Returns (success, error_message)
    """
    if not packages:
        return True, ""

    try:
        for pkg in packages:
            result = subprocess.run(
                ["uv", "pip", "install", "--system", pkg],
                capture_output=True,
                text=True,
                timeout=300,
            )
            if result.returncode != 0:
                error_msg = result.stderr.strip() or result.stdout.strip()
                if len(error_msg) > 200:
                    error_msg = error_msg[:200] + "..."
                return False, f"Failed to install {pkg}: {error_msg}"
        return True, ""
    except subprocess.TimeoutExpired:
        return False, "Installation timed out (>5 min)"
    except Exception as e:
        return False, str(e)


def install_servers(config_path: str) -> dict[str, Any]:
    """
    Install all MCP servers from the config file.

    Returns a summary dict with installation results.
    """
    console.print(f"\n[bold blue]Loading MCP configuration from {config_path}[/bold blue]")

    config = parse_mcp_config(config_path)
    servers = config.get("mcpServers", {})

    console.print(f"[cyan]Found {len(servers)} MCP servers to process[/cyan]\n")

    results = {
        "installed": [],
        "remote": [],
        "failed": [],
        "skipped": [],
        "errors": {},  # Store error details
    }

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Installing servers...", total=len(servers))

        for server_name, server_config in servers.items():
            progress.update(task, description=f"Processing {server_name}...")

            info = extract_package_info(server_name, server_config)

            if info is None or info.get("type") == "unknown":
                console.print(f"  [yellow]→ {server_name}: Unknown config format, skipping[/yellow]")
                results["skipped"].append(server_name)

            elif info["type"] == "remote":
                console.print(f"  [dim]→ {server_name}: Remote URL (no install needed)[/dim]")
                results["remote"].append(server_name)

            elif info["type"] == "uvx":
                package = info["full_package"]
                with_deps = info.get("with_deps", [])
                deps_str = f" (with deps: {with_deps})" if with_deps else ""
                console.print(f"  [cyan]→ Installing {server_name} via uvx ({package}{deps_str})...[/cyan]")

                success, error = install_uvx_package(info["package"], package, with_deps)
                if success:
                    console.print(f"    [green]✓ Installed {package}[/green]")
                    results["installed"].append(server_name)
                else:
                    console.print(f"    [red]✗ Failed: {error}[/red]")
                    results["failed"].append(server_name)
                    results["errors"][server_name] = error

            elif info["type"] == "uvx_deps_only":
                # These servers use --with at runtime, uvx handles deps automatically
                # DO NOT install system-wide to avoid version conflicts with gateway deps
                with_deps = info.get("with_deps", [])
                console.print(f"  [dim]→ {server_name}: Runtime deps ({with_deps}) - uvx handles at runtime[/dim]")
                results["skipped"].append(server_name)

            elif info["type"] == "npx":
                package = info["package"]
                console.print(f"  [cyan]→ Installing {server_name} via npm ({package})...[/cyan]")

                success, error = install_npx_package(package)
                if success:
                    console.print(f"    [green]✓ Installed {package}[/green]")
                    results["installed"].append(server_name)
                else:
                    console.print(f"    [red]✗ Failed: {error}[/red]")
                    results["failed"].append(server_name)
                    results["errors"][server_name] = error

            elif info["type"] == "uv":
                # uv run commands handle --with deps at runtime
                # DO NOT install system-wide to avoid version conflicts with gateway deps
                packages = info.get("packages", [])
                if packages:
                    console.print(f"  [dim]→ {server_name}: Runtime deps ({packages}) - uv handles at runtime[/dim]")
                else:
                    console.print(f"  [dim]→ {server_name}: uv command (no pre-install needed)[/dim]")
                results["skipped"].append(server_name)

            else:
                console.print(f"  [yellow]→ {server_name}: Unhandled type '{info.get('type')}', skipping[/yellow]")
                results["skipped"].append(server_name)

            progress.advance(task)

    # Print summary
    console.print("\n[bold]Installation Summary:[/bold]")
    console.print(f"  [green]✓ Installed: {len(results['installed'])}[/green]")
    console.print(f"  [blue]→ Remote: {len(results['remote'])}[/blue]")
    console.print(f"  [yellow]⊘ Skipped: {len(results['skipped'])}[/yellow]")
    console.print(f"  [red]✗ Failed: {len(results['failed'])}[/red]")

    # Show detailed error info for failures
    if results["failed"]:
        console.print(f"\n[bold red]Failed servers:[/bold red]")
        for server in results["failed"]:
            error = results["errors"].get(server, "Unknown error")
            console.print(f"  • {server}")
            console.print(f"    [dim]{error}[/dim]")

    return results


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        console.print("[red]Usage: install_servers.py <mcp.json path>[/red]")
        sys.exit(1)

    config_path = sys.argv[1]

    if not Path(config_path).exists():
        console.print(f"[red]Config file not found: {config_path}[/red]")
        sys.exit(1)

    results = install_servers(config_path)

    # Exit with error if critical failures
    if len(results["failed"]) > len(results["installed"]) + len(results["remote"]):
        console.print("\n[red]Too many failures, exiting with error[/red]")
        sys.exit(1)

    console.print("\n[green]Server installation complete![/green]")


if __name__ == "__main__":
    main()
