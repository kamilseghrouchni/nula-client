#!/usr/bin/env python3
"""
BioContextAI Registry Fetcher
Fetches and caches the MCP server registry from BioContextAI
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import httpx


REGISTRY_URL = "https://biocontext.ai/registry.json"
CACHE_DIR = Path(__file__).parent.parent / "config"
CACHE_FILE = CACHE_DIR / "registry-cache.json"


def fetch_registry(url: str = REGISTRY_URL) -> List[Dict]:
    """Fetch registry from BioContextAI"""
    print(f"Fetching registry from {url}...")
    try:
        response = httpx.get(url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()
        data = response.json()
        print(f"✓ Successfully fetched {len(data)} servers")
        return data
    except httpx.HTTPError as e:
        print(f"✗ HTTP error fetching registry: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"✗ JSON decode error: {e}")
        sys.exit(1)


def load_cached_registry() -> Optional[Dict]:
    """Load cached registry if it exists"""
    if not CACHE_FILE.exists():
        return None

    try:
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not load cache: {e}")
        return None


def save_registry_cache(registry: List[Dict], metadata: Optional[Dict] = None):
    """Save registry to cache with metadata"""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    cache_data = {
        "timestamp": datetime.now().isoformat(),
        "server_count": len(registry),
        "metadata": metadata or {},
        "servers": registry
    }

    with open(CACHE_FILE, 'w') as f:
        json.dump(cache_data, f, indent=2)

    print(f"✓ Cached registry to {CACHE_FILE}")


def categorize_servers(servers: List[Dict]) -> Dict[str, List[Dict]]:
    """Categorize servers by programming language and type"""
    categories = {
        "python": [],
        "typescript": [],
        "javascript": [],
        "remote": [],
        "other": []
    }

    for server in servers:
        # Check if it's a remote server
        if server.get("url"):
            categories["remote"].append(server)

        # Categorize by language
        languages = server.get("programmingLanguage", [])
        if isinstance(languages, str):
            languages = [languages]

        if "Python" in languages:
            categories["python"].append(server)
        elif "TypeScript" in languages:
            categories["typescript"].append(server)
        elif "JavaScript" in languages:
            categories["javascript"].append(server)
        else:
            categories["other"].append(server)

    return categories


def detect_changes(old_cache: Optional[Dict], new_registry: List[Dict]) -> Dict:
    """Detect changes between cached and new registry"""
    if not old_cache:
        return {
            "has_changes": True,
            "new_servers": len(new_registry),
            "updated_servers": 0,
            "removed_servers": 0
        }

    old_servers = {s["identifier"]: s for s in old_cache.get("servers", [])}
    new_servers = {s["identifier"]: s for s in new_registry}

    old_ids = set(old_servers.keys())
    new_ids = set(new_servers.keys())

    added = new_ids - old_ids
    removed = old_ids - new_ids
    common = old_ids & new_ids

    # Check for updates in common servers
    updated = []
    for server_id in common:
        # Simple comparison - could be more sophisticated
        if old_servers[server_id] != new_servers[server_id]:
            updated.append(server_id)

    has_changes = bool(added or removed or updated)

    changes = {
        "has_changes": has_changes,
        "new_servers": list(added),
        "removed_servers": list(removed),
        "updated_servers": updated,
        "total_servers": len(new_registry)
    }

    if has_changes:
        print(f"\n📊 Registry Changes Detected:")
        print(f"  • New servers: {len(added)}")
        print(f"  • Removed servers: {len(removed)}")
        print(f"  • Updated servers: {len(updated)}")
        print(f"  • Total servers: {len(new_registry)}")

        if added:
            print(f"\n  New:")
            for server_id in list(added)[:5]:
                print(f"    + {server_id}")
            if len(added) > 5:
                print(f"    ... and {len(added) - 5} more")

        if removed:
            print(f"\n  Removed:")
            for server_id in list(removed)[:5]:
                print(f"    - {server_id}")
            if len(removed) > 5:
                print(f"    ... and {len(removed) - 5} more")
    else:
        print("✓ No changes detected in registry")

    return changes


def generate_summary(registry: List[Dict]) -> Dict:
    """Generate summary statistics about the registry"""
    categories = categorize_servers(registry)

    # Extract tags
    all_tags = set()
    for server in registry:
        tags = server.get("keywords", [])
        if isinstance(tags, list):
            all_tags.update(tags)

    # Count maintainers
    maintainers = set()
    for server in registry:
        maintainer_list = server.get("maintainer", [])
        if isinstance(maintainer_list, list):
            for m in maintainer_list:
                if isinstance(m, dict) and "name" in m:
                    maintainers.add(m["name"])

    summary = {
        "total_servers": len(registry),
        "by_language": {
            "python": len(categories["python"]),
            "typescript": len(categories["typescript"]),
            "javascript": len(categories["javascript"]),
            "other": len(categories["other"])
        },
        "remote_servers": len(categories["remote"]),
        "total_tags": len(all_tags),
        "total_maintainers": len(maintainers),
        "top_tags": list(sorted(all_tags))[:20]
    }

    print(f"\n📈 Registry Summary:")
    print(f"  Total servers: {summary['total_servers']}")
    print(f"  Python: {summary['by_language']['python']}")
    print(f"  TypeScript: {summary['by_language']['typescript']}")
    print(f"  JavaScript: {summary['by_language']['javascript']}")
    print(f"  Remote endpoints: {summary['remote_servers']}")
    print(f"  Maintainers: {summary['total_maintainers']}")

    return summary


def main():
    """Main entry point"""
    print("🔍 BioContextAI Registry Fetcher\n")

    # Load cached version
    old_cache = load_cached_registry()

    # Fetch new registry
    registry = fetch_registry()

    # Detect changes
    changes = detect_changes(old_cache, registry)

    # Generate summary
    summary = generate_summary(registry)

    # Save to cache
    metadata = {
        "changes": changes,
        "summary": summary
    }
    save_registry_cache(registry, metadata)

    # Exit code: 0 if changes, 1 if no changes (for scripting)
    sys.exit(0 if changes["has_changes"] else 1)


if __name__ == "__main__":
    main()
