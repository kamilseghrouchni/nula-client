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

## Project Overview

This is a Next.js 16 web application that provides a chat interface for metabolomics data analysis. The application integrates with the Model Context Protocol (MCP) to connect to external analysis tools and uses Claude (Anthropic's API) for AI-powered conversations.

## Architecture

### MCP Integration Layer

The core architecture revolves around MCP (Model Context Protocol) integration:

- **Configuration**: `mcp-config.json` at project root defines MCP server configurations
  - Structure: `{ mcpServers: { [name]: { command, args, env } } }`
  - Currently configured to connect to `eda-mcp` (exploratory data analysis) server

- **MCP Client**: `src/lib/mcp/client.ts` and `src/lib/mcp/config.ts`
  - Singleton pattern: MCP client initialized once per API route lifecycle
  - Uses `StdioClientTransport` from `@modelcontextprotocol/sdk`
  - Client created via AI SDK's `experimental_createMCPClient`

### AI Streaming Architecture

- **Route Handler**: `src/app/api/chat/route.ts` (Next.js Route Handler)
  - Receives messages as `UIMessage[]` from client
  - Initializes MCP client if not already connected
  - Loads MCP tools dynamically from connected server
  - Uses AI SDK's `streamText` with Claude Sonnet 4
  - Streams responses back to client using `toUIMessageStreamResponse()`
  - Implements detailed step logging via `onStepFinish` callback
  - `maxDuration: 60` seconds for serverless function timeout
  - `stopWhen: stepCountIs(50)` to prevent infinite loops

- **System Prompt**: `src/lib/prompts/system.ts`
  - Domain-specific: metabolomics data analysis assistant
  - Enforces visualization constraints (recharts only, specific color palette)
  - Critical workflow instruction: call tools → wait for results → analyze → provide answer

### Frontend Architecture

- **Chat Interface**: `src/app/chat/page.tsx`
  - Uses `useChat` hook from `@ai-sdk/react` for real-time streaming
  - Auto-scrolls to latest message
  - Displays loading states and errors
  - Input disabled during streaming

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

### UI Components

- **Radix UI primitives**: Avatar, Dialog, Dropdown, Tooltip, Select, Collapsible
- **Custom UI components**: `src/components/ui/` (shadcn/ui-style components)
- **AI-specific components**: `src/components/ai-elements/` (conversation, code-block, etc.)
- Styled with Tailwind CSS v4 using `@tailwindcss/postcss`

## Important Patterns

### MCP Tool Lifecycle
1. User sends message → `POST /api/chat`
2. API route initializes/reuses MCP client singleton
3. Client fetches available tools from MCP server
4. Tools passed to `streamText` along with messages
5. Claude can invoke MCP tools during generation
6. Tool results streamed back to client as message parts

### Message Part Types
Messages from AI SDK contain parts array:
- `{ type: 'text', text: string }` - Text content
- `{ type: 'tool-call', toolName, args, state }` - Tool invocation
- `{ type: 'tool-result', toolName, result, isError }` - Tool response

### Visualization Constraints
When generating visualizations via artifacts:
- Only recharts library allowed (enforced by sandbox)
- Must export default function component
- Color palette: #6D33A6, #1E2940, #265573, #0FDBF2, #217282, #3A5E77
- Keep under 100 lines
- One focused plot per artifact
- Always use ResponsiveContainer for responsive sizing

## Configuration Notes

- **TypeScript**: Uses `@/*` path alias for `./src/*`
- **React 19**: Using latest React version with React Compiler enabled
- **Module Type**: ESM (type: "module" in package.json)
- **Babel Config**: React preset enabled for JSX artifact transformation
- **Target**: ES2017 for broader compatibility

## Key Dependencies

- `ai` + `@ai-sdk/anthropic`: Vercel AI SDK for streaming and Anthropic integration
- `@modelcontextprotocol/sdk`: MCP client for external tool connections
- `@babel/standalone`: Runtime JSX transformation for artifacts
- `recharts`: Only allowed charting library for visualizations
- `better-sqlite3`: Database (likely for data analysis in MCP server)
- `next-themes`: Theme management (dark/light mode support)

## Development Notes

- MCP client is stateful and persists across requests in same API route instance
- Tool execution happens server-side through MCP protocol
- Artifact rendering happens client-side in isolated environment
- All visualizations must be recharts-based (no D3, Plotly, etc.)
- Domain focus: metabolomics data analysis
