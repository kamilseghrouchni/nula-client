#!/usr/bin/env python3
"""
BioContextAI Docker Compose Generator
Generates docker-compose.yml from server selection and configurations
"""
import json
import yaml
import sys
from pathlib import Path
from typing import Dict, List, Set


CACHE_DIR = Path(__file__).parent.parent / "config"
REGISTRY_CACHE = CACHE_DIR / "registry-cache.json"
MCP_CONFIGS_FILE = CACHE_DIR / "mcp-configs.json"
SELECTION_FILE = CACHE_DIR / "selection.yaml"
OUTPUT_FILE = Path(__file__).parent.parent / "docker-compose.yml"
ENV_FILE = Path(__file__).parent.parent / ".env"


def load_selection() -> Dict:
    """Load server selection configuration"""
    if not SELECTION_FILE.exists():
        print(f"✗ Selection file not found: {SELECTION_FILE}")
        print("  Copy selection.yaml.example to selection.yaml and customize")
        sys.exit(1)

    with open(SELECTION_FILE, 'r') as f:
        return yaml.safe_load(f)


def load_configs() -> Dict:
    """Load extracted MCP configurations"""
    if not MCP_CONFIGS_FILE.exists():
        print("✗ MCP configs not found. Run extract-configs.py first.")
        sys.exit(1)

    with open(MCP_CONFIGS_FILE, 'r') as f:
        return json.load(f)


def load_registry() -> List[Dict]:
    """Load registry for metadata"""
    if not REGISTRY_CACHE.exists():
        print("✗ Registry cache not found. Run fetch-registry.py first.")
        sys.exit(1)

    with open(REGISTRY_CACHE, 'r') as f:
        data = json.load(f)
        return data.get("servers", [])


def filter_servers(selection: Dict, configs: Dict, registry: List[Dict]) -> Dict[str, Dict]:
    """Filter servers based on selection criteria"""
    selected = {}

    strategy = selection.get("strategy", "specific")

    if strategy == "all":
        # Select all servers
        selected = configs.copy()

    elif strategy == "specific":
        # Select specific servers by identifier
        server_ids = selection.get("servers", [])
        for server_id in server_ids:
            if server_id in configs:
                selected[server_id] = configs[server_id]
            else:
                print(f"  ⚠ Server not found: {server_id}")

    elif strategy == "category":
        # Select by category (would need category mapping)
        # For now, select by tags in keywords
        categories = selection.get("categories", [])
        for server_id, config in configs.items():
            keywords = config.get("_metadata", {}).get("keywords", [])
            if any(cat in keywords for cat in categories):
                selected[server_id] = config

    elif strategy == "tags":
        # Select by tags
        tags = selection.get("tags", [])
        for server_id, config in configs.items():
            keywords = config.get("_metadata", {}).get("keywords", [])
            if any(tag in keywords for tag in tags):
                selected[server_id] = config

    # Apply exclusions
    exclude = selection.get("exclude", [])
    for server_id in exclude:
        if server_id in selected:
            del selected[server_id]
            print(f"  ✗ Excluded: {server_id}")

    # Apply max_servers limit
    max_servers = selection.get("max_servers", 0)
    if max_servers > 0 and len(selected) > max_servers:
        selected = dict(list(selected.items())[:max_servers])
        print(f"  ℹ Limited to {max_servers} servers")

    # Filter remote/local based on preferences
    prefer_remote = selection.get("prefer_remote", False)
    include_remote_only = selection.get("include_remote_only", True)

    filtered = {}
    for server_id, config in selected.items():
        is_remote = config.get("transport") == "http" and config.get("url")

        if is_remote and not include_remote_only:
            continue

        filtered[server_id] = config

    return filtered


def generate_service_name(identifier: str) -> str:
    """Generate Docker service name from identifier"""
    # Convert foo/bar to foo-bar
    return identifier.replace("/", "-").replace("_", "-").lower()


def generate_service_config(
    identifier: str,
    config: Dict,
    port: int,
    selection: Dict
) -> Dict:
    """Generate Docker Compose service configuration"""
    service_name = generate_service_name(identifier)
    metadata = config.get("_metadata", {})

    # Get resource limits
    resource_limits = selection.get("resource_limits", {})
    default_limits = resource_limits.get("default", {})
    overrides = resource_limits.get("overrides", {})
    limits = overrides.get(identifier, default_limits)

    # Base service config
    service = {
        "container_name": service_name,
        "networks": ["mcp_network"],
        "restart": selection.get("advanced", {}).get("restart_policy", "unless-stopped")
    }

    # Handle different transport types
    transport = config.get("transport")
    command = config.get("command")

    if transport == "http" and config.get("url"):
        # Remote HTTP server - create a proxy/reference
        service["image"] = "alpine:latest"
        service["command"] = ["tail", "-f", "/dev/null"]  # Keep container running
        service["environment"] = [
            f"REMOTE_URL={config['url']}",
            f"TRANSPORT=http"
        ]

    elif command == "uvx":
        # Python uvx-based server
        package = config.get("args", [])[0] if config.get("args") else "unknown"
        service["build"] = {
            "context": f"./servers/{service_name}",
            "dockerfile": "Dockerfile"
        }
        service["environment"] = [
            f"UV_PYTHON={config.get('env', {}).get('UV_PYTHON', '3.12')}",
            f"PORT={port}",
            "MCP_ENVIRONMENT=PRODUCTION"
        ]
        service["ports"] = [f"127.0.0.1:{port}:{port}"]

    elif command == "npx":
        # Node.js npx-based server
        service["build"] = {
            "context": f"./servers/{service_name}",
            "dockerfile": "Dockerfile"
        }
        service["environment"] = [
            "NODE_ENV=production",
            f"PORT={port}"
        ]
        service["ports"] = [f"127.0.0.1:{port}:{port}"]

    elif command == "bunx":
        # Bun-based server
        service["build"] = {
            "context": f"./servers/{service_name}",
            "dockerfile": "Dockerfile"
        }
        service["environment"] = [
            f"PORT={port}",
            "MCP_TRANSPORT_TYPE=http"
        ]
        service["ports"] = [f"127.0.0.1:{port}:{port}"]

    else:
        # Generic/unknown
        service["image"] = "alpine:latest"
        service["command"] = ["echo", f"Unsupported command: {command}"]

    # Add global env vars
    global_env = selection.get("env_vars", {})
    for key, value in global_env.items():
        service.setdefault("environment", []).append(f"{key}={value}")

    # Add server-specific env vars
    server_env = selection.get("server_env_vars", {}).get(identifier, {})
    for key, value in server_env.items():
        service.setdefault("environment", []).append(f"{key}={value}")

    # Add resource limits
    if limits:
        service["deploy"] = {
            "resources": {
                "limits": {}
            }
        }
        if "cpu" in limits:
            service["deploy"]["resources"]["limits"]["cpus"] = str(limits["cpu"])
        if "memory" in limits:
            service["deploy"]["resources"]["limits"]["memory"] = limits["memory"]

    # Add volume for data persistence
    service["volumes"] = [f"{service_name}-data:/app/data"]

    # Add health check if enabled
    if selection.get("advanced", {}).get("enable_health_checks", True):
        interval = selection.get("advanced", {}).get("health_check_interval", 30)
        if port and command in ["uvx", "npx", "bunx"]:
            service["healthcheck"] = {
                "test": ["CMD", "curl", "-f", f"http://localhost:{port}/health"],
                "interval": f"{interval}s",
                "timeout": "10s",
                "retries": 3,
                "start_period": "40s"
            }

    return service


def generate_compose_file(selected_servers: Dict[str, Dict], selection: Dict):
    """Generate complete docker-compose.yml"""
    port_range = selection.get("port_range", {"start": 8000, "end": 8099})
    current_port = port_range["start"]

    compose = {
        "version": "3.9",
        "networks": {
            "mcp_network": {
                "driver": "bridge"
            }
        },
        "volumes": {},
        "services": {}
    }

    # Generate service for each selected server
    for identifier, config in selected_servers.items():
        service_name = generate_service_name(identifier)

        # Assign port
        port = current_port
        current_port += 1

        # Generate service config
        service = generate_service_config(identifier, config, port, selection)
        compose["services"][service_name] = service

        # Add volume
        compose["volumes"][f"{service_name}-data"] = {"driver": "local"}

    # Add MCP Gateway service
    gateway_port = selection.get("gateway_port", 9000)
    compose["services"]["mcp-gateway"] = {
        "build": {
            "context": "./gateway",
            "dockerfile": "Dockerfile"
        },
        "container_name": "mcp-gateway",
        "ports": [f"127.0.0.1:{gateway_port}:{gateway_port}"],
        "networks": ["mcp_network"],
        "environment": [
            f"GATEWAY_PORT={gateway_port}",
            "LOG_LEVEL=info"
        ],
        "depends_on": list(compose["services"].keys()),
        "restart": "unless-stopped"
    }

    # Save to file
    with open(OUTPUT_FILE, 'w') as f:
        yaml.dump(compose, f, default_flow_style=False, sort_keys=False)

    print(f"✓ Generated docker-compose.yml with {len(selected_servers)} servers")
    print(f"  Gateway port: {gateway_port}")
    print(f"  Server ports: {port_range['start']}-{current_port-1}")


def generate_dockerfiles(selected_servers: Dict[str, Dict]):
    """Generate Dockerfile for each server"""
    servers_dir = Path(__file__).parent.parent / "servers"

    for identifier, config in selected_servers.items():
        service_name = generate_service_name(identifier)
        server_dir = servers_dir / service_name
        server_dir.mkdir(parents=True, exist_ok=True)

        dockerfile_path = server_dir / "Dockerfile"

        command = config.get("command")
        metadata = config.get("_metadata", {})

        if command == "uvx":
            # Python uvx-based Dockerfile
            package = config.get("args", [])[0] if config.get("args") else "unknown"
            # Extract package name without version (e.g., biocontext_kb from biocontext_kb@latest)
            package_name = package.split('@')[0].split('/')[-1]

            dockerfile = f"""FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install the package globally
RUN uv tool install {package}

# Add uv tools to PATH
ENV PATH="/root/.local/bin:$PATH"

# Expose port
EXPOSE 8000

# Set environment
ENV MCP_ENVIRONMENT=PRODUCTION
ENV PORT=8000

# Run the server directly (executable installed in /root/.local/bin)
CMD ["{package_name}"]
"""

        elif command == "npx":
            # Node.js npx-based Dockerfile
            package = config.get("args", [])[0] if config.get("args") else "unknown"
            dockerfile = f"""FROM node:20-slim

WORKDIR /app

# Install the package globally
RUN npm install -g {package}

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Run the server
CMD ["npx", "{package}"]
"""

        elif command == "bunx":
            # Bun-based Dockerfile
            package = config.get("args", [])[0] if config.get("args") else "unknown"
            dockerfile = f"""FROM oven/bun:1-slim

WORKDIR /app

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000

# Run the server
CMD ["bunx", "{package}"]
"""

        else:
            # Generic Dockerfile
            dockerfile = """FROM alpine:latest
CMD ["echo", "Server configuration not supported"]
"""

        with open(dockerfile_path, 'w') as f:
            f.write(dockerfile)

    print(f"✓ Generated Dockerfiles for {len(selected_servers)} servers")


def generate_env_file(selection: Dict):
    """Generate .env.example file"""
    env_content = """# BioContextAI MCP Deployment Environment Variables

# Gateway Configuration
GATEWAY_PORT=9000

# Global Settings
LOG_LEVEL=info
MCP_ENVIRONMENT=PRODUCTION

# API Keys (uncomment and fill in as needed)
# GALAXY_API_KEY=your_galaxy_api_key
# PUBMED_API_KEY=your_pubmed_api_key
"""

    env_example = Path(__file__).parent.parent / ".env.example"
    with open(env_example, 'w') as f:
        f.write(env_content)

    print(f"✓ Generated .env.example")


def main():
    """Main entry point"""
    print("🐳 BioContextAI Docker Compose Generator\n")

    # Load data
    print("📂 Loading configuration files...")
    selection = load_selection()
    configs = load_configs()
    registry = load_registry()

    # Filter servers
    print("\n🔍 Filtering servers based on selection...")
    selected = filter_servers(selection, configs, registry)
    print(f"✓ Selected {len(selected)} servers")

    if not selected:
        print("\n✗ No servers selected. Check your selection.yaml configuration.")
        sys.exit(1)

    # Print selected servers
    print("\n📋 Selected Servers:")
    for i, (identifier, config) in enumerate(selected.items(), 1):
        name = config.get("_metadata", {}).get("name", identifier)
        print(f"  {i}. {name} ({identifier})")

    # Generate Docker Compose file
    print("\n🔨 Generating Docker Compose configuration...")
    generate_compose_file(selected, selection)

    # Generate Dockerfiles
    print("\n📝 Generating Dockerfiles...")
    generate_dockerfiles(selected)

    # Generate .env.example
    print("\n📄 Generating environment file...")
    generate_env_file(selection)

    print("\n✅ Docker Compose generation complete!")
    print(f"\nNext steps:")
    print(f"  1. Review docker-compose.yml")
    print(f"  2. Copy .env.example to .env and configure")
    print(f"  3. Run: docker-compose up -d")


if __name__ == "__main__":
    main()
