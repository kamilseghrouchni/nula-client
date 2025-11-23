#!/bin/bash
set -e

# BioContextAI MCP Deployment Script
# Automated deployment of MCP servers from BioContextAI registry

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_DIR/config"
VENV_DIR="$PROJECT_DIR/.venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is required but not installed"
        exit 1
    fi
    log_success "Python 3 found"

    # Check for Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed"
        exit 1
    fi
    log_success "Docker found"

    # Check for Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is required but not installed"
        exit 1
    fi
    log_success "Docker Compose found"
}

# Setup virtual environment
setup_venv() {
    log_info "Setting up Python virtual environment..."

    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
        log_success "Virtual environment created"
    fi

    source "$VENV_DIR/bin/activate"

    pip install --quiet --upgrade pip
    pip install --quiet -r "$SCRIPT_DIR/requirements.txt"

    log_success "Dependencies installed"
}

# Fetch registry
fetch_registry() {
    log_info "Fetching BioContextAI registry..."

    if python "$SCRIPT_DIR/fetch-registry.py"; then
        log_success "Registry fetched and cached"
        return 0
    else
        log_warn "No registry changes detected"
        return 1
    fi
}

# Extract configurations
extract_configs() {
    log_info "Extracting MCP configurations..."

    python "$SCRIPT_DIR/extract-configs.py"

    log_success "Configurations extracted"
}

# Generate Docker Compose
generate_compose() {
    log_info "Generating Docker Compose configuration..."

    python "$SCRIPT_DIR/generate-compose.py"

    log_success "Docker Compose generated"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_DIR"

    if docker-compose build 2>/dev/null || docker compose build; then
        log_success "Docker images built"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

# Start services
start_services() {
    log_info "Starting MCP services..."

    cd "$PROJECT_DIR"

    if docker-compose up -d 2>/dev/null || docker compose up -d; then
        log_success "Services started"
    else
        log_error "Failed to start services"
        exit 1
    fi
}

# Show status
show_status() {
    log_info "Service status:"

    cd "$PROJECT_DIR"

    if docker-compose ps 2>/dev/null || docker compose ps; then
        echo ""
    fi
}

# Wait for gateway
wait_for_gateway() {
    log_info "Waiting for gateway to be ready..."

    MAX_ATTEMPTS=30
    ATTEMPT=0

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if curl -s http://localhost:9000/health > /dev/null 2>&1; then
            log_success "Gateway is ready"
            return 0
        fi

        ATTEMPT=$((ATTEMPT + 1))
        sleep 1
    done

    log_error "Gateway failed to start within timeout"
    return 1
}

# Show gateway info
show_gateway_info() {
    log_info "MCP Gateway information:"

    GATEWAY_INFO=$(curl -s http://localhost:9000/)
    echo "$GATEWAY_INFO" | python -m json.tool

    log_info "Available backends:"
    curl -s http://localhost:9000/backends | python -m json.tool
}

# Main deployment flow
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║   BioContextAI MCP Server Auto-Deployment System      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""

    # Parse command line arguments
    CHECK_UPDATES=false
    REBUILD=false
    STOP=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --check-updates)
                CHECK_UPDATES=true
                shift
                ;;
            --rebuild)
                REBUILD=true
                shift
                ;;
            --stop)
                STOP=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--check-updates] [--rebuild] [--stop]"
                exit 1
                ;;
        esac
    done

    # Handle stop command
    if [ "$STOP" = true ]; then
        log_info "Stopping all services..."
        cd "$PROJECT_DIR"
        docker-compose down 2>/dev/null || docker compose down
        log_success "Services stopped"
        exit 0
    fi

    # Check prerequisites
    check_prerequisites

    # Setup environment
    setup_venv

    # Check for updates if requested
    NEEDS_REBUILD=false
    if [ "$CHECK_UPDATES" = true ]; then
        if fetch_registry; then
            log_info "Registry updated, rebuilding configuration..."
            extract_configs
            generate_compose
            NEEDS_REBUILD=true
        fi
    else
        # Always fetch and generate on first run
        if [ ! -f "$CONFIG_DIR/registry-cache.json" ]; then
            fetch_registry
            extract_configs
        fi

        if [ ! -f "$CONFIG_DIR/selection.yaml" ]; then
            log_error "No selection.yaml found. Copy selection.yaml.example and customize."
            exit 1
        fi

        if [ ! -f "$PROJECT_DIR/docker-compose.yml" ] || [ "$REBUILD" = true ]; then
            generate_compose
            NEEDS_REBUILD=true
        fi
    fi

    # Build and start services
    if [ "$NEEDS_REBUILD" = true ] || [ "$REBUILD" = true ]; then
        build_images
    fi

    start_services

    # Wait for gateway
    if wait_for_gateway; then
        echo ""
        show_gateway_info
        echo ""
        log_success "🎉 Deployment complete!"
        echo ""
        log_info "Gateway URL: http://localhost:9000/mcp"
        log_info "Health check: http://localhost:9000/health"
        log_info "Backends: http://localhost:9000/backends"
        echo ""
        log_info "To stop services: $0 --stop"
        log_info "To check for updates: $0 --check-updates"
    else
        log_error "Deployment failed"
        show_status
        exit 1
    fi
}

# Run main function
main "$@"
