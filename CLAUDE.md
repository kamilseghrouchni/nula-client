# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
next build

# Run production server
npm start

# Run linter
eslint
```

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/
│   │   ├── chat/            # Main chat endpoint
│   │   ├── extract-insight/ # Workflow insight extraction
│   │   ├── test-mcp/        # MCP connection testing
│   │   └── debug-sleepyrat/ # Sleepyrat debugging
│   ├── chat/                # Main chat page
│   └── page.tsx             # Landing page
├── components/
│   ├── ai-elements/         # AI-specific components (plan, reasoning, etc.)
│   ├── artifact/            # Artifact rendering & download
│   ├── chat/                # Message rendering components
│   ├── notebook/            # Lab notebook (artifact gallery)
│   ├── plans/               # Strategic plans panel
│   ├── ui/                  # Shadcn UI components
│   ├── workflow/            # Workflow visualization (ReactFlow)
│   └── RightPanel.tsx       # Unified tabbed panel
├── lib/
│   ├── cache/               # Plan caching to filesystem
│   ├── context/             # Session context building
│   ├── mcp/                 # Multi-MCP client manager
│   ├── prompts/             # System prompts
│   ├── sandbox/             # JSX execution sandbox
│   ├── summarization/       # Conversation summarization
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # Utilities (token counting, downloads, etc.)
│   └── workflow/            # Workflow graph building & phase detection
└── styles/                  # Global styles

data/                        # Generated at runtime
└── plans/                   # Cached analysis plans (JSON)

mcp-config.json             # MCP server configuration
.env.example                # Environment variable template
CLAUDE.md                   # This file (project documentation)
```

## Project Overview

This is a Next.js 16 web application (NulaLabs) that provides an AI-powered metabolomics data analysis platform. The application features:

- **Multi-MCP Server Integration**: Connects to multiple analysis servers simultaneously (eda-mcp, sleepyrat)
- **Interactive Workflow Visualization**: ReactFlow-based graph showing analysis journey with phase detection
- **Strategic Planning System**: AI-generated analysis plans with step-by-step execution
- **Lab Notebook**: Gallery of all visualizations with download capabilities
- **Smart Token Management**: Automatic conversation summarization and prompt caching
- **Session Context Tracking**: Maintains state of loaded datasets and executed analyses

## Architecture

### MCP Integration Layer

The core architecture revolves around MCP (Model Context Protocol) integration:

- **Configuration**: `mcp-config.json` at project root defines MCP server configurations
  - Structure: `{ mcpServers: { [name]: { command, args, env, transport } } }`
  - Supports multiple servers: `eda-mcp` (local), `sleepyrat` (remote via mcp-remote)
  - Environment variable interpolation: `${SLEEPYRAT_TOKEN}` replaced at runtime
  - Supports both STDIO (local) and HTTP (remote) transports

- **Multi-MCP Client Manager**: `src/lib/mcp/multiClient.ts`
  - Manages connections to MULTIPLE MCP servers simultaneously
  - Graceful degradation: continues if one server fails
  - Tool namespacing: tools prefixed with server name (e.g., `sleepyrat__analyze`)
  - Automatic tool merging from all connected servers
  - Connection state tracking and error handling

- **Token Management**: `src/lib/mcp/tokenFetcher.ts`
  - Dynamic token fetching for remote servers (Sleepyrat)
  - Supports both direct token and username/password authentication
  - Runtime injection of tokens into MCP configuration

### AI Streaming Architecture

- **Route Handler**: `src/app/api/chat/route.ts` (Next.js Route Handler)
  - Receives messages as `UIMessage[]` from client
  - Initializes multi-MCP client manager if not already connected
  - Loads and merges tools from ALL connected MCP servers
  - Uses AI SDK's `streamText` with Claude Sonnet 4
  - **Anthropic Prompt Caching**: Caches system prompt and conversation history as ephemeral
  - **Token Management**: Automatic summarization when context exceeds limits
  - **Session Context**: Injects loaded datasets and tool history into system prompt
  - Streams responses back to client using `toUIMessageStreamResponse()`
  - Implements detailed step logging via `onStepFinish` callback
  - `maxDuration: 60` seconds for serverless function timeout
  - `stopWhen: stepCountIs(25)` to prevent infinite loops

- **System Prompt**: `src/lib/prompts/system.ts`
  - Domain-specific: metabolomics data analysis assistant
  - Enforces visualization constraints (recharts only, specific color palette)
  - Critical workflow instruction: call tools → wait for results → analyze → provide answer
  - Dynamic context injection: loaded datasets, previous tool calls

- **Conversation Summarization**: `src/lib/summarization/summarizer.ts`
  - Automatically detects when token count exceeds limits (100k tokens)
  - Uses Claude Haiku for fast, cost-effective summarization
  - Keeps recent messages (last 10) intact for context continuity
  - Injects summary as synthetic system message
  - Token counting via `src/lib/utils/tokenCounter.ts`

- **Session Context**: `src/lib/context/dataContext.ts`
  - Tracks all tool calls across conversation
  - Maintains list of loaded datasets with metadata
  - Formats context for injection into system prompt
  - Prevents redundant tool calls by providing session state

### Frontend Architecture

- **Chat Interface**: `src/app/chat/page.tsx`
  - Uses `useChat` hook from `@ai-sdk/react` for real-time streaming
  - Auto-scrolls to latest message with `use-stick-to-bottom` hook
  - Displays loading states and errors
  - Input disabled during streaming
  - **Smart Follow-up Suggestions**: Extracts AI-suggested questions (via `---FOLLOWUP---` delimiter)
  - **Workflow Generation**: Builds visual workflow graph from conversation history
  - **Plan Extraction**: Detects and displays strategic plans from AI responses
  - **Right Panel Integration**: Manages Plans, Workflow, and Lab Notebook views
  - **Keyboard Shortcuts**: Cmd+Enter to execute latest plan

- **Message Rendering**: `src/components/chat/Message.tsx`
  - Processes message parts: `text`, `tool-call`, `tool-result`
  - `ToolCall.tsx`: Shows tool invocations with args and state
  - `ToolResult.tsx`: Displays tool execution results
  - `TextContent.tsx`: Renders text responses

- **Artifact Rendering**: `src/components/artifact/ArtifactRenderer.tsx`
  - Executes JSX artifacts in sandboxed environment
  - Uses `src/lib/sandbox/jsxExecutor.ts` for secure execution
  - Only allows recharts and react imports
  - Transforms JSX using Babel standalone at runtime
  - Error boundaries for failed artifact execution
  - **Download Capabilities**: Export as PNG or SVG via `ArtifactDownloadButton.tsx`
  - **Hidden Pool**: `HiddenArtifactPool.tsx` renders artifacts in DOM for download functionality

### Workflow Visualization System

Complete workflow system showing analysis journey as interactive graph:

- **Workflow Panel**: `src/components/workflow/WorkflowPanel.tsx`
  - Main container with split view: canvas (left) + artifacts panel (right)
  - Responsive layout with collapsible sections
  - Auto-opens when workflow data available

- **Workflow Canvas**: `src/components/workflow/WorkflowCanvas.tsx`
  - ReactFlow-based interactive graph visualization
  - Custom nodes (`WorkflowNode.tsx`) showing analysis steps
  - Custom edges (`WorkflowEdge.tsx`) for parallel connections
  - Minimap and controls for navigation
  - Node selection updates artifacts panel

- **Artifacts Panel**: `src/components/workflow/ArtifactsPanel.tsx`
  - Shows details for selected node
  - Displays phase, reasoning, and extracted insights
  - Renders associated visualizations
  - Download buttons for each artifact

- **Phase Detection**: `src/lib/workflow/phaseDetector.ts`
  - Automatically categorizes analysis steps into phases:
    1. Data Loading
    2. QC Assessment
    3. Data Preprocessing
    4. Exploratory Analysis
    5. Statistical Testing
    6. Dimensionality Reduction
    7. Comparative Analysis
    8. Visualization
  - Uses tool names and reasoning text for classification

- **Insight Extraction**: Multiple strategies with fallbacks
  - `insightExtractor.ts`: LLM-based (Claude Haiku) for concise summaries
  - `simpleInsightExtractor.ts`: Pattern-based extraction from text
  - `metadataExtractor.ts`: Explicit annotations from AI reasoning
  - Async extraction via `/api/extract-insight` endpoint

- **Layout Management**: `src/lib/workflow/useWorkflowLayout.ts`
  - Dagre algorithm for automatic graph layout
  - Handles horizontal flow with proper spacing
  - Maintains visual hierarchy

### Strategic Planning System

AI-generated analysis plans with execution tracking:

- **Plans Panel**: `src/components/plans/PlansPanel.tsx`
  - Displays structured analysis plans from AI
  - Markdown rendering for rich formatting
  - "Build" button to execute plan steps
  - Keyboard shortcut support (Cmd+Enter)

- **Plan Extraction**: `src/lib/utils/extractPlans.ts`
  - Detects `<plan>` tags in AI responses
  - Fallback: auto-detection of structured plans
  - Extracts title, description, and steps

- **Plan Caching**: `src/lib/cache/planCache.ts`
  - Persists plans to file system (`/data/plans/`)
  - Stores metadata: timestamp, tools used, user query
  - Enables plan history and retrieval

### Lab Notebook

Gallery view of all generated visualizations:

- **Lab Notebook**: `src/components/notebook/LabNotebook.tsx`
  - Aggregates ALL artifacts from conversation
  - Shows artifact count and enumeration
  - Scrollable gallery with download buttons
  - Organized by creation order

### Right Panel System

Unified tabbed interface for auxiliary views:

- **Right Panel**: `src/components/RightPanel.tsx`
  - Three tabs: Plans, Workflow, Lab Notebook
  - Auto-opens when new content appears
  - Collapsible with close button
  - Takes 50% width when open, responsive layout
  - Tab badges show content counts

### JSX Sandbox Security

The `jsxExecutor.ts` implements a security layer for dynamic code execution:
- Validates imports against whitelist (`ALLOWED_IMPORTS`)
- Uses Babel standalone to transform JSX → JS at runtime
- Executes in isolated scope using `new Function()`
- Only recharts and react are permitted imports
- This prevents arbitrary code execution while enabling data visualizations

### Type Definitions

- `src/lib/types/index.ts` defines core types:
  - `Message`: Chat message with role, content, and tool invocations
  - `ToolInvocation`: Represents MCP tool calls with state tracking
  - `Artifact`: Supports jsx, text, and json artifact types
  - `Plan`: Strategic plan with title, content, and metadata

- `src/lib/types/workflow.ts` defines workflow types:
  - `WorkflowNodeType`: "user_query" | "analysis" | "visualization"
  - `WorkflowNodeStatus`: "completed" | "in_progress" | "error"
  - `WorkflowEdgeType`: "sequential" | "parallel"
  - `WorkflowNode`: Node with phase, reasoning, insights, artifacts
  - `WorkflowEdge`: Connection between nodes
  - `WorkflowGraph`: Complete graph structure
  - `WorkflowMetadata`: Extracted workflow information

### UI Components

- **Radix UI primitives**: Avatar, Dialog, Dropdown, Tooltip, Select, Collapsible, HoverCard, ScrollArea
- **Custom UI components**: `src/components/ui/` (shadcn/ui-style components)
  - Card, Badge, Input, Button, etc.
  - Command palette (`command.tsx`) using `cmdk`
- **AI-specific components**: `src/components/ai-elements/`
  - `conversation.tsx`, `code-block.tsx` - Core chat elements
  - `plan.tsx`, `reasoning.tsx` - AI response components
  - `task.tsx`, `queue.tsx` - Status indicators
- **Workflow components**: `src/components/workflow/`
  - `WorkflowNode.tsx`, `WorkflowEdge.tsx` - Custom ReactFlow components
  - `ArtifactsPanel.tsx` - Node detail viewer
- **Feature panels**: `src/components/plans/`, `src/components/notebook/`
- Styled with Tailwind CSS v4 using `@tailwindcss/postcss`

## Important Patterns

### MCP Tool Lifecycle
1. User sends message → `POST /api/chat`
2. API route initializes multi-MCP client manager (connects to all servers)
3. Manager fetches tools from ALL connected servers and merges them
4. Tools namespaced by server name (e.g., `sleepyrat__analyze`)
5. Session context (loaded datasets, tool history) injected into system prompt
6. Tools + messages + context passed to `streamText`
7. Claude can invoke MCP tools during generation
8. Tool results streamed back to client as message parts
9. Workflow graph updated in real-time on client
10. Plans and follow-up suggestions extracted from responses

### Message Part Types
Messages from AI SDK contain parts array:
- `{ type: 'text', text: string }` - Text content
- `{ type: 'tool-call', toolName, args, state }` - Tool invocation
- `{ type: 'tool-result', toolName, result, isError }` - Tool response

### Workflow Graph Building
Client-side workflow generation from conversation:
1. Extract all assistant messages with tool calls or artifacts
2. Detect phase for each analysis step (via `phaseDetector.ts`)
3. Create nodes: user queries, analyses, visualizations
4. Create edges: sequential or parallel connections
5. Extract insights asynchronously (LLM-based or pattern-based)
6. Apply Dagre layout for visual organization
7. Cache complete workflow to prevent partial updates during streaming

### Plan Extraction and Execution
1. AI generates plan with `<plan>` tags or structured format
2. `extractPlans.ts` parses plan from message text
3. Plan displayed in Plans Panel with markdown rendering
4. User clicks "Build" or presses Cmd+Enter
5. Plan content sent as new message to AI
6. AI executes plan steps sequentially

### Smart Follow-up Suggestions
1. AI includes suggestions after `---FOLLOWUP---` delimiter
2. `extractFollowups.ts` parses suggestions from response
3. Displayed as clickable chips below input
4. User can click chip or press Enter to send suggestion
5. Auto-clears when user starts typing

### Visualization Constraints
When generating visualizations via artifacts:
- Only recharts library allowed (enforced by sandbox)
- Must export default function component
- Color palette: #6D33A6, #1E2940, #265573, #0FDBF2, #217282, #3A5E77
- Keep under 100 lines
- One focused plot per artifact
- Always use ResponsiveContainer for responsive sizing
- Artifacts downloadable as PNG or SVG via `html-to-image`

## Configuration Notes

- **TypeScript**: Uses `@/*` path alias for `./src/*`
- **React 19**: Using latest React version with React Compiler enabled
- **Module Type**: ESM (type: "module" in package.json)
- **Babel Config**: React preset enabled for JSX artifact transformation
- **Target**: ES2017 for broader compatibility

### Environment Variables

Required environment variables (see `.env.example`):

```bash
# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Sleepyrat MCP Server (choose one method)
SLEEPYRAT_TOKEN=your_sleepyrat_token  # Direct token
# OR
SLEEPYRAT_USERNAME=username           # Username/password auth
SLEEPYRAT_PASSWORD=password
```

Token fetching:
- `tokenFetcher.ts` dynamically fetches Sleepyrat tokens
- Supports both direct token and username/password authentication
- Tokens injected at runtime into MCP configuration
- `${SLEEPYRAT_TOKEN}` placeholders replaced automatically

### MCP Configuration

`mcp-config.json` structure:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "command-to-run",        // For STDIO transport
      "args": ["arg1", "arg2"],
      "env": { "VAR": "value" },
      "transport": "stdio"                // or "http"
    },
    "remote-server": {
      "transport": "http",
      "url": "https://api.example.com",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"  // Variable interpolation
      }
    }
  }
}
```

Current servers:
- `eda-mcp`: Local exploratory data analysis (STDIO)
- `sleepyrat`: Remote sleep data analysis (HTTP via mcp-remote)

## Key Dependencies

### Core Framework
- `next` (16.1.2): Next.js framework with App Router
- `react` + `react-dom` (19.0.0): Latest React with React Compiler
- `typescript` (5.7.3): Type safety

### AI & MCP Integration
- `ai` (4.0.28): Vercel AI SDK for streaming
- `@ai-sdk/anthropic` (1.0.14): Anthropic provider for Claude
- `@ai-sdk/react` (1.0.6): React hooks for chat UI
- `@modelcontextprotocol/sdk` (1.1.0): MCP client for external tool connections
- `mcp-remote`: Remote MCP server connections via HTTP

### Workflow & Visualization
- `@xyflow/react` (12.9.2): Interactive workflow diagrams with ReactFlow
- `dagre` (0.8.5): Graph layout algorithm for workflow canvas
- `recharts` (2.15.1): Only allowed charting library for data visualizations
- `html-to-image` (1.11.13): Export visualizations as PNG/SVG

### UI Components
- `@radix-ui/*`: Headless UI primitives (Avatar, Dialog, Dropdown, Tooltip, etc.)
- `cmdk` (1.1.1): Command palette component
- `next-themes` (0.4.5): Theme management (dark/light mode)

### Content & Markdown
- `react-markdown` (10.1.0): Markdown rendering for plans
- `prism-react-renderer` (2.4.1): Code syntax highlighting
- `streamdown` (1.4.0): Streaming markdown processor
- `@babel/standalone` (7.26.7): Runtime JSX transformation for artifacts

### Utilities
- `nanoid` (5.1.6): Unique ID generation
- `use-stick-to-bottom` (1.1.1): Auto-scroll behavior for chat
- `better-sqlite3` (11.8.1): Database for data analysis in MCP servers

## API Routes

### `/api/chat` (POST)
Main chat endpoint handling AI streaming:
- Initializes multi-MCP client manager
- Loads tools from all connected servers
- Manages token limits with automatic summarization
- Implements Anthropic prompt caching
- Injects session context (datasets, tool history)
- Returns streamed response with tool calls
- Runtime: Node.js, 60s timeout

### `/api/extract-insight` (POST)
Async insight extraction for workflow nodes:
- Input: `{ responseText: string, phase: string }`
- Output: `{ insight: string }`
- Uses Claude Haiku for cost-effective extraction
- 100-character limit for concise insights
- Runtime: Node.js, 30s timeout

### `/api/test-mcp` (GET)
Debug endpoint for testing MCP connections:
- Tests all configured servers
- Returns connection status and available tools
- Used for troubleshooting MCP setup

### `/api/debug-sleepyrat` (GET)
Debug endpoint for Sleepyrat integration:
- Tests Sleepyrat-specific configuration
- Validates token fetching
- Returns server status

## Commit and PR Message Guidelines

**NEVER include Claude attribution in commit messages or PR descriptions**

When creating commits or pull requests, DO NOT add any AI attribution markers:

❌ DO NOT include:
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- `Co-Authored-By: Claude <noreply@anthropic.com>`
- Any other Claude/AI attribution markers

Keep commit messages and PR descriptions clean and professional without any AI attribution. Focus on describing what changed and why, not how the code was generated.

## Development Notes

### Architecture Patterns
- **Multi-server MCP**: Manager connects to ALL servers, gracefully handles failures
- **Tool namespacing**: Prevents conflicts between servers (e.g., `sleepyrat__analyze`)
- **Prompt caching**: Anthropic ephemeral cache for system prompt + history
- **Token management**: Auto-summarization at 100k token threshold
- **Workflow caching**: Client preserves complete graph during streaming
- **Async insight extraction**: LLM-powered summaries via separate endpoint

### Performance Optimizations
- Prompt caching reduces API costs and latency
- Dagre layout runs client-side to avoid blocking
- Insight extraction happens asynchronously (non-blocking)
- Workflow only rebuilds when streaming completes
- Session context prevents redundant tool calls

### Security Considerations
- JSX sandbox: Only recharts/react imports allowed
- Environment variable interpolation server-side only
- Token fetching happens at runtime (not committed to config)
- MCP tools execute server-side (never exposed to client)

### Domain-Specific Notes
- Domain focus: metabolomics and sleep data analysis
- All visualizations must be recharts-based (no D3, Plotly, etc.)
- Color palette enforced by system prompt
- Analysis phases specific to metabolomics workflow
- Tool execution happens server-side through MCP protocol
- Artifact rendering happens client-side in isolated environment
