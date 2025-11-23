#!/usr/bin/env python3
"""
Generate mcp-config.json for NulaLabs Client
Creates MCP configuration to connect to the gateway or individual servers
"""
import json
import sys
from pathlib import Path
from typing import Dict, List


PROJECT_DIR = Path(__file__).parent.parent
CONFIG_DIR = PROJECT_DIR / "config"
MCP_CONFIGS_FILE = CONFIG_DIR / "mcp-configs.json"
DOCKER_COMPOSE_FILE = PROJECT_DIR / "docker-compose.yml"
NULA_CONFIG_FILE = PROJECT_DIR.parent / "mcp-config.json"


def load_configs() -> Dict:
    """Load extracted MCP configurations"""
    if not MCP_CONFIGS_FILE.exists():
        print("✗ MCP configs not found. Run extract-configs.py first.")
        sys.exit(1)

    with open(MCP_CONFIGS_FILE, 'r') as f:
        return json.load(f)


def generate_gateway_config(gateway_port: int = 9000) -> Dict:
    """Generate config to connect via gateway"""
    return {
        "mcpServers": {
            "biocontext-gateway": {
                "transport": "http",
                "url": f"http://localhost:{gateway_port}/mcp"
            }
        }
    }


def generate_direct_config(configs: Dict, base_port: int = 8000) -> Dict:
    """Generate config to connect directly to individual servers"""
    mcp_config = {"mcpServers": {}}

    port = base_port
    for identifier, config in configs.items():
        service_name = identifier.replace("/", "-").replace("_", "-").lower()

        # Skip if not deployable
        if config.get("command") == "unknown":
            continue

        # Create server entry
        mcp_config["mcpServers"][service_name] = {
            "transport": "http",
            "url": f"http://localhost:{port}/mcp"
        }

        port += 1

    return mcp_config


def merge_with_existing(new_config: Dict) -> Dict:
    """Merge new config with existing mcp-config.json"""
    if not NULA_CONFIG_FILE.exists():
        return new_config

    try:
        with open(NULA_CONFIG_FILE, 'r') as f:
            existing = json.load(f)

        # Merge mcpServers
        if "mcpServers" in existing:
            new_config["mcpServers"].update(existing["mcpServers"])

        return new_config
    except:
        return new_config


def save_config(config: Dict, output_path: Path):
    """Save configuration to file"""
    with open(output_path, 'w') as f:
        json.dump(config, f, indent=2)

    print(f"✓ Saved configuration to {output_path}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Generate mcp-config.json for NulaLabs")
    parser.add_argument("--mode", choices=["gateway", "direct", "both"], default="gateway",
                        help="Connection mode: gateway (unified), direct (individual servers), or both")
    parser.add_argument("--output", type=Path, help="Output file path (default: ../mcp-config.json)")
    parser.add_argument("--gateway-port", type=int, default=9000, help="Gateway port")
    parser.add_argument("--base-port", type=int, default=8000, help="Base port for direct connections")
    parser.add_argument("--merge", action="store_true", help="Merge with existing config")
    args = parser.parse_args()

    print("🔧 Generating NulaLabs MCP Configuration\n")

    # Load server configs
    configs = load_configs()

    # Generate appropriate config
    if args.mode == "gateway":
        config = generate_gateway_config(args.gateway_port)
        print(f"✓ Generated gateway configuration (port {args.gateway_port})")

    elif args.mode == "direct":
        config = generate_direct_config(configs, args.base_port)
        print(f"✓ Generated direct configuration ({len(config['mcpServers'])} servers)")

    elif args.mode == "both":
        gateway_config = generate_gateway_config(args.gateway_port)
        direct_config = generate_direct_config(configs, args.base_port)
        config = {
            "mcpServers": {
                **gateway_config["mcpServers"],
                **direct_config["mcpServers"]
            }
        }
        print(f"✓ Generated combined configuration")

    # Merge if requested
    if args.merge:
        config = merge_with_existing(config)
        print(f"✓ Merged with existing configuration")

    # Determine output path
    output_path = args.output or NULA_CONFIG_FILE

    # Save config
    save_config(config, output_path)

    # Print summary
    print(f"\n📊 Configuration Summary:")
    print(f"  Mode: {args.mode}")
    print(f"  Servers: {len(config['mcpServers'])}")
    print(f"  Output: {output_path}")

    print(f"\n✅ Done! Update your NulaLabs client to use this configuration.")

    if args.mode == "gateway":
        print(f"\n🌐 Single endpoint: http://localhost:{args.gateway_port}/mcp")
    else:
        print(f"\n🔗 Multiple endpoints starting at port {args.base_port}")


if __name__ == "__main__":
    main()
