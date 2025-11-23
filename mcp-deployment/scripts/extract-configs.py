#!/usr/bin/env python3
"""
BioContextAI MCP Config Extractor
Extracts MCP configuration from server repositories
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional
import httpx
from bs4 import BeautifulSoup
import anthropic


CACHE_DIR = Path(__file__).parent.parent / "config"
REGISTRY_CACHE = CACHE_DIR / "registry-cache.json"
MCP_CONFIGS_FILE = CACHE_DIR / "mcp-configs.json"
SELECTION_FILE = CACHE_DIR / "selection.yaml"


def load_registry() -> List[Dict]:
    """Load cached registry"""
    if not REGISTRY_CACHE.exists():
        print("✗ Registry cache not found. Run fetch-registry.py first.")
        sys.exit(1)

    with open(REGISTRY_CACHE, 'r') as f:
        data = json.load(f)
        return data.get("servers", [])


def fetch_readme(repo_url: str) -> Optional[str]:
    """Fetch README from GitHub repository"""
    # Convert GitHub URL to raw README URL
    # https://github.com/user/repo -> https://raw.githubusercontent.com/user/repo/main/README.md

    if not "github.com" in repo_url:
        return None

    parts = repo_url.rstrip('/').split('/')
    if len(parts) < 2:
        return None

    user = parts[-2]
    repo = parts[-1]

    # Try common branch names
    for branch in ['main', 'master', 'HEAD']:
        raw_url = f"https://raw.githubusercontent.com/{user}/{repo}/{branch}/README.md"
        try:
            response = httpx.get(raw_url, timeout=10.0, follow_redirects=True)
            if response.status_code == 200:
                return response.text
        except:
            continue

    return None


def extract_json_blocks(text: str) -> List[Dict]:
    """Extract JSON code blocks from markdown"""
    configs = []

    # Pattern for JSON code blocks
    json_pattern = r'```(?:json)?\s*\n(.*?)\n```'
    matches = re.findall(json_pattern, text, re.DOTALL)

    for match in matches:
        try:
            data = json.loads(match)
            # Check if it's MCP related
            if isinstance(data, dict) and ("mcpServers" in data or "command" in data or "transport" in data):
                configs.append(data)
        except json.JSONDecodeError:
            continue

    return configs


def parse_mcp_config(config_data: Dict) -> Optional[Dict]:
    """Parse and validate MCP configuration"""
    # Handle wrapped format: { "mcpServers": { "name": {...} } }
    if "mcpServers" in config_data:
        servers = config_data["mcpServers"]
        if isinstance(servers, dict):
            # Return first server config
            for server_name, server_config in servers.items():
                return server_config

    # Handle direct format: { "command": "...", "args": [...] }
    if "command" in config_data or "url" in config_data:
        return config_data

    return None


# Invalid package names to reject
INVALID_PACKAGES = {
    # Flags
    '--version', '--help', '-y', '-v', '--from', '--verbose',
    # Command modes
    'stdio', 'server', 'http', 'sse', 'run',
    # npm scripts
    'build', 'start', 'dev', 'test', 'install', 'sync', 'publish',
    # Common words
    'can', 'the', 'and', 'with', 'from', 'or', 'to', 'a', 'in', 'is', 'you', 'be', 'it', 'of', 'for', 'on', 'at', 'by', 'this', 'that', 'was', 'are', 'as', 'so', 'if', 'but', 'not', 'all', 'have', 'has', 'do', 'does', 'did', 'without', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'needs'
}


def validate_package_name(name: str) -> bool:
    """Validate that a package name is legitimate"""
    if not name or len(name) < 3:
        return False

    # Reject flags
    if name.startswith('-'):
        return False

    # Reject invalid packages
    if name.lower() in INVALID_PACKAGES:
        return False

    # Must match valid package name pattern
    if not re.match(r'^[a-zA-Z@][a-zA-Z0-9_/@-]+$', name):
        return False

    return True


def extract_config_from_readme(readme: str, server_name: str) -> Optional[Dict]:
    """Extract MCP configuration from README with robust validation"""
    # Try to extract JSON blocks (highest confidence)
    json_blocks = extract_json_blocks(readme)

    for block in json_blocks:
        config = parse_mcp_config(block)
        if config:
            # Validate the extracted package
            args = config.get("args", [])
            if args:
                # Handle --from flag: uvx --from package-name
                if args[0] == "--from" and len(args) > 1:
                    package = args[1]
                else:
                    package = args[0]

                if validate_package_name(package):
                    print(f"  ✓ Extracted config from JSON block")
                    return config
                else:
                    print(f"  ⚠ Rejected invalid package from JSON: {package}")

    # Look for uvx pattern with validation
    # Pattern matches: uvx [--from] package[@version]
    uvx_pattern = r'uvx\s+(?:--from\s+)?(@?[a-zA-Z][a-zA-Z0-9_/-]*[a-zA-Z0-9])(?:@[a-zA-Z0-9_.]+)?'
    uvx_matches = re.findall(uvx_pattern, readme)

    for package in uvx_matches:
        if validate_package_name(package):
            print(f"  ✓ Found valid uvx pattern: {package}")
            return {
                "command": "uvx",
                "args": [package],
                "env": {"UV_PYTHON": "3.12"}
            }
        else:
            print(f"  ⚠ Rejected invalid uvx package: {package}")

    # Look for npx pattern with validation
    # Pattern matches: npx [-y] [@scope/]package
    npx_pattern = r'npx\s+(?:-y\s+)?(@?[a-zA-Z][a-zA-Z0-9_/-]*[a-zA-Z0-9])(?:@[a-zA-Z0-9_.]+)?'
    npx_matches = re.findall(npx_pattern, readme)

    for package in npx_matches:
        # Special case: Smithery CLI
        if package == "@smithery/cli":
            # Look for: npx -y @smithery/cli install actual-package
            smithery_pattern = r'@smithery/cli\s+install\s+([a-zA-Z0-9@/_-]+)'
            smithery_match = re.search(smithery_pattern, readme)
            if smithery_match:
                actual_package = smithery_match.group(1)
                if validate_package_name(actual_package):
                    print(f"  ✓ Found Smithery-installed package: {actual_package}")
                    return {
                        "command": "npx",
                        "args": [actual_package]
                    }
            continue

        if validate_package_name(package):
            print(f"  ✓ Found valid npx pattern: {package}")
            return {
                "command": "npx",
                "args": [package]
            }
        else:
            print(f"  ⚠ Rejected invalid npx package: {package}")

    # Look for bunx pattern with validation
    bunx_pattern = r'bunx\s+([a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9])(?:@[a-zA-Z0-9_.]+)?'
    bunx_matches = re.findall(bunx_pattern, readme)

    for package in bunx_matches:
        if validate_package_name(package):
            print(f"  ✓ Found valid bunx pattern: {package}")
            return {
                "command": "bunx",
                "args": [package]
            }
        else:
            print(f"  ⚠ Rejected invalid bunx package: {package}")

    return None


def llm_extract_config(readme: str, server_info: Dict) -> Optional[Dict]:
    """Use Claude to extract MCP configuration from README"""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""Extract the MCP (Model Context Protocol) server configuration from this README.

Server Name: {server_info.get('name')}
Programming Language: {server_info.get('programmingLanguage')}

README Content:
{readme[:4000]}  # Limit to first 4000 chars

Please extract the MCP configuration in this exact JSON format:
{{
  "command": "uvx" or "npx" or "bunx" or other command,
  "args": ["package-name@latest" or other arguments],
  "env": {{ optional environment variables }},
  "transport": "stdio" or "http" (optional),
  "url": "https://..." (for remote servers only)
}}

If this is a remote server (has a URL endpoint), use this format:
{{
  "transport": "http",
  "url": "https://example.com/mcp/"
}}

If you cannot find a clear configuration, respond with just: {{"error": "No configuration found"}}
"""

    try:
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text.strip()

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            config = json.loads(json_match.group(0))
            if "error" not in config:
                print(f"  ✓ LLM extracted configuration")
                return config
    except Exception as e:
        print(f"  ✗ LLM extraction failed: {e}")

    return None


def infer_config_from_metadata(server: Dict) -> Dict:
    """Infer basic configuration from server metadata"""
    languages = server.get("programmingLanguage", [])
    if isinstance(languages, str):
        languages = [languages]

    identifier = server.get("identifier", "unknown")
    package_name = identifier.split("/")[-1]

    # Check if it has a remote URL
    if server.get("url"):
        return {
            "transport": "http",
            "url": server["url"]
        }

    # Infer command based on language
    if "Python" in languages:
        return {
            "command": "uvx",
            "args": [f"{package_name}@latest"],
            "env": {"UV_PYTHON": "3.12"}
        }
    elif "TypeScript" in languages or "JavaScript" in languages:
        return {
            "command": "npx",
            "args": [f"{package_name}@latest"]
        }
    else:
        return {
            "command": "unknown",
            "args": [],
            "note": "Manual configuration required"
        }


def extract_all_configs(servers: List[Dict], use_llm: bool = False) -> Dict[str, Dict]:
    """Extract MCP configurations for all servers"""
    configs = {}

    print(f"\n📥 Extracting MCP configurations for {len(servers)} servers\n")

    for i, server in enumerate(servers, 1):
        identifier = server.get("identifier", "unknown")
        name = server.get("name", identifier)
        repo_url = server.get("codeRepository")

        print(f"[{i}/{len(servers)}] {name}")

        config = None

        # Step 0: Check if server has remote URL - prefer this over local installation
        if server.get("url"):
            print(f"  ✓ Using remote URL from registry")
            config = {
                "transport": "http",
                "url": server["url"]
            }

        # Step 1: Try to fetch and parse README
        if not config and repo_url:
            readme = fetch_readme(repo_url)
            if readme:
                config = extract_config_from_readme(readme, name)

                # Step 2: Try LLM extraction if enabled and no config found
                if not config and use_llm:
                    import os
                    if os.getenv("ANTHROPIC_API_KEY"):
                        config = llm_extract_config(readme, server)

        # Step 3: Infer from metadata
        if not config:
            print(f"  ℹ Using inferred configuration")
            config = infer_config_from_metadata(server)

        # Add metadata
        config["_metadata"] = {
            "identifier": identifier,
            "name": name,
            "codeRepository": repo_url,
            "programmingLanguage": server.get("programmingLanguage", []),
            "url": server.get("url"),
            "keywords": server.get("keywords", [])
        }

        configs[identifier] = config

    print(f"\n✓ Extracted {len(configs)} configurations")
    return configs


def save_configs(configs: Dict[str, Dict]):
    """Save extracted configurations"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    with open(MCP_CONFIGS_FILE, 'w') as f:
        json.dump(configs, f, indent=2)

    print(f"✓ Saved configurations to {MCP_CONFIGS_FILE}")


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(description="Extract MCP configurations from BioContextAI registry")
    parser.add_argument("--use-llm", action="store_true", help="Use Claude to extract configs (requires ANTHROPIC_API_KEY)")
    parser.add_argument("--limit", type=int, help="Limit number of servers to process")
    args = parser.parse_args()

    print("🔍 BioContextAI MCP Config Extractor\n")

    # Load registry
    servers = load_registry()

    if args.limit:
        servers = servers[:args.limit]
        print(f"ℹ Processing limited to {args.limit} servers\n")

    # Extract configurations
    configs = extract_all_configs(servers, use_llm=args.use_llm)

    # Save to file
    save_configs(configs)

    # Print summary
    config_types = {}
    for config in configs.values():
        cmd = config.get("command", config.get("transport", "unknown"))
        config_types[cmd] = config_types.get(cmd, 0) + 1

    print(f"\n📊 Configuration Summary:")
    for cmd, count in sorted(config_types.items()):
        print(f"  {cmd}: {count}")


if __name__ == "__main__":
    main()
