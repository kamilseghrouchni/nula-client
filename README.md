<div align="center">
  <img src="./assets/banner.png" alt="NulaLabs Banner" width="100%">
</div>

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.20-purple)](https://modelcontextprotocol.io)

</div>

Transform your data analysis workflow with an intelligent chat interface that connects to multiple MCP servers, provides visual workflow tracking, and generates publication-ready visualizations - all powered by Claude Sonnet 4.5.

---

## 🌟 What is NulaLabs?

NulaLabs is a next-generation web application that brings the power of AI to your data analysis workflow. Built on the Model Context Protocol (MCP), it enables seamless integration with multiple data sources and analysis tools through an intuitive conversational interface.

**Perfect for:**
- 🧬 Metabolomics researchers conducting exploratory data analysis
- 😴 Sleep scientists analyzing polysomnography data
- 📊 Data scientists building reproducible analysis workflows
- 🔬 Lab teams collaborating on data interpretation

---

## ✨ Key Features

### 🔌 Multi-MCP Server Integration
**What it does:** Connect to unlimited MCP servers simultaneously
**Why it matters:** Access all your tools in one place - no switching between applications

- Automatic tool discovery and namespacing
- Graceful degradation if servers are unavailable
- Support for both local (STDIO) and remote (HTTP) servers
- Pre-configured integrations for popular data platforms

### 📊 Visual Workflow Tracking
**What it does:** Automatically maps your analysis journey into a visual workflow diagram
**Why it matters:** Never lose track of your analysis steps - perfect for reproducibility and documentation

- Real-time workflow graph generation
- Phase detection (Data Loading → QC → Analysis → Visualization)
- Insight extraction for each analysis step
- Export workflows for presentations and publications

### 📓 Lab Notebook
**What it does:** Organizes all visualizations and artifacts in one searchable interface
**Why it matters:** Keep your analysis organized and accessible

- View all generated charts and plots
- Download artifacts as standalone HTML files
- Navigate between multiple visualizations
- Export for presentations with one click

### ✨ Strategic Planning
**What it does:** AI generates structured analysis plans with actionable steps
**Why it matters:** Get expert guidance on complex analyses

```markdown
<plan title="Metabolomics Data Analysis">
## Phase 1: Data Quality Assessment
- Calculate CV in PooledQC samples
- Assess reproducibility across batches

## Phase 2: Statistical Analysis
- Differential abundance testing
- Pathway enrichment analysis
</plan>
```

### 💬 Smart Follow-up Suggestions
**What it does:** Context-aware next-step suggestions after each AI response
**Why it matters:** Streamlined workflow - one click to continue your analysis

- Intelligent question suggestions
- Based on current analysis context
- Clickable chips for instant execution

### 🔒 Privacy & Security First
**What it does:** Enterprise-grade security for your sensitive data
**Why it matters:** Protect patient data, proprietary research, and confidential information

- No hardcoded credentials in codebase
- Dynamic token injection from environment variables
- User data never exposed in responses
- Secure authentication handling

### 🎨 Publication-Ready Visualizations
**What it does:** Professional interactive charts built with Recharts
**Why it matters:** Generate figures ready for papers and presentations

- PCA plots, bar charts, line plots, scatter plots
- Statistical distribution visualizations
- Professional color palettes
- Responsive and interactive

---

## 🎯 Benefits

| Feature | Benefit |
|---------|---------|
| **Multi-Server Support** | Eliminate tool switching - access all your data sources in one interface |
| **Workflow Visualization** | Improve reproducibility - visual documentation of analysis steps |
| **AI-Powered Assistance** | Reduce analysis time - get expert guidance on complex data |
| **Privacy Protection** | Maintain compliance - enterprise-grade security for sensitive data |
| **Smart Follow-ups** | Accelerate workflow - contextual next-step suggestions |
| **Publication-Ready** | Save time - export-ready visualizations and workflows |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ ([Download](https://nodejs.org))
- npm or yarn
- Anthropic API key ([Get one](https://console.anthropic.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/nulalabs.git
cd nulalabs

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Configure Environment

Create a `.env` file in the project root:

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-your_api_key_here

# Optional: MCP Server Authentication
SLEEPYRAT_TOKEN=your_sleepyrat_token
```

### Configure MCP Servers

Create or edit `mcp-config.json` at the project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    },
    "sleepyrat": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://sleepyrat.ai/api/mcp-tools",
        "--header",
        "Authorization: Bearer ${SLEEPYRAT_TOKEN}"
      ]
    }
  }
}
```

### Run the Application

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

**That's it!** Start chatting with your AI assistant and analyze your data.

---

## 📖 Usage Guide

### Basic Workflow

1. **Start a conversation** - Ask a question about your data
2. **AI initializes** - Automatically connects to MCP servers and loads tools
3. **Get insights** - Receive analysis, visualizations, and recommendations
4. **Track progress** - View workflow diagram in real-time
5. **Export results** - Download visualizations and workflow diagrams

### Example Conversations

**Metabolomics Analysis:**
```
You: "Analyze the quality of my metabolomics data"
AI: [Initializes session, loads data, calculates QC metrics]
    "I've calculated the CV for PooledQC samples. Average CV is 12%..."
    [Workflow node created: "QC Assessment"]
    [Generates QC metrics visualization]
Follow-up: "Would you like to see outlier detection results?"
```

**Sleep Data Analysis:**
```
You: "Show me the sleep stage distribution for project X"
AI: [Lists available projects, loads selected project]
    "Found 24 recordings. Here's the stage distribution..."
    [Workflow node created: "Data Loading"]
    [Generates sleep stage pie chart]
Follow-up: "Shall I analyze sleep bout durations?"
```

### Workflow Visualization

The workflow panel automatically tracks your analysis:

```
Session Init → Data Loading → QC Assessment → Statistical Analysis → Visualization
     ↓              ↓               ↓                   ↓                  ↓
  Projects      Loaded 245       CV: 12%         p<0.05 (23)        Bar Chart
  Available     metabolites      No outliers      metabolites        Generated
```

### Using the Lab Notebook

1. Click "Notebook" in the top-right panel
2. Browse all generated visualizations
3. Click the download icon to export as HTML
4. Share standalone files with collaborators

### Strategic Plans

Ask for analysis guidance:

```
You: "Create a plan for analyzing this metabolomics dataset"
AI: [Generates structured plan]
    Phase 1: QC Assessment
    Phase 2: Statistical Testing
    Phase 3: Pathway Analysis
```

Click on a plan to execute it step-by-step.

---

## ⚙️ Configuration

### MCP Server Setup

#### Local Servers (STDIO)

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    }
  }
}
```

#### Remote Servers (HTTP via mcp-remote)

```json
{
  "mcpServers": {
    "remote-api": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://api.example.com/mcp-tools",
        "--header",
        "Authorization: Bearer ${API_TOKEN}"
      ],
      "env": {}
    }
  }
}
```

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional: MCP Server Tokens (use ${VARIABLE} in mcp-config.json)
SLEEPYRAT_TOKEN=your_token
CUSTOM_SERVER_TOKEN=your_token

# Optional: Server Credentials
SERVER_USERNAME=username
SERVER_PASSWORD=password
```

### Token Placeholder Resolution

Use `${VARIABLE_NAME}` in `mcp-config.json` to reference environment variables:

```json
{
  "args": ["--header", "Authorization: Bearer ${SLEEPYRAT_TOKEN}"]
}
```

Tokens are automatically injected at runtime from `.env` - **never** commit tokens to git!

---

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4 |
| **AI** | Anthropic Claude Sonnet 4.5 |
| **MCP** | @modelcontextprotocol/sdk |
| **Visualization** | Recharts, ReactFlow |
| **State** | React hooks, client-side caching |

### Project Structure

```
nulalabs/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/              # Main chat API route
│   │   └── chat/                  # Chat page UI
│   ├── components/
│   │   ├── chat/                  # Message components
│   │   ├── workflow/              # Workflow visualization
│   │   ├── notebook/              # Lab notebook
│   │   ├── artifact/              # Artifact rendering
│   │   ├── plans/                 # Strategic plans
│   │   └── ui/                    # UI primitives
│   └── lib/
│       ├── mcp/                   # MCP client management
│       │   ├── multiClient.ts     # Multi-server manager
│       │   ├── config.ts          # Configuration loader
│       │   └── tokenFetcher.ts    # Secure token handling
│       ├── workflow/              # Workflow building
│       │   ├── workflowBuilder.ts # Graph construction
│       │   ├── phaseDetector.ts   # Phase detection
│       │   └── metadataExtractor.ts # Insight extraction
│       ├── prompts/               # System prompts
│       └── utils/                 # Utilities
├── mcp-config.json                # MCP server configuration
├── .env                           # Environment variables (create from .env.example)
└── .env.example                   # Example environment file
```

### Data Flow

```
User Input → Next.js API Route → MCP Client Manager → Multiple MCP Servers
                                        ↓
                                  Tool Discovery
                                        ↓
                               Claude Sonnet 4.5 ← System Prompts
                                        ↓
                                  Streaming Response
                                        ↓
                            Workflow Builder + Insight Extractor
                                        ↓
                              UI (Chat + Workflow + Notebook)
```

---

## 🛠️ Development

### Development Commands

```bash
# Start development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Adding a New MCP Server

1. **Add configuration to `mcp-config.json`**

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server"]
    }
  }
}
```

2. **Add environment variables to `.env` (if needed)**

```bash
MY_SERVER_TOKEN=your_token
```

3. **Restart the development server**

```bash
npm run dev
```

4. **Verify connection**

Check the console for: `[MCP] ✓ Connected to my-server`

### Customizing AI Behavior

Edit `src/lib/prompts/system.ts`:

```typescript
export function buildSystemPrompt(): string {
  return `You are a data analysis assistant...

  // Add your custom instructions here
  `;
}
```

### Creating Custom Visualizations

All visualizations must use Recharts:

```jsx
import { BarChart, Bar, XAxis, YAxis } from 'recharts';

export default function CustomViz() {
  const data = [/* your data */];

  return (
    <BarChart data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Bar dataKey="value" fill="#3b82f6" />
    </BarChart>
  );
}
```

---

## 🎨 Visualization Guidelines

### Allowed Libraries
- ✅ **recharts** - All components (Bar, Line, Scatter, Pie, Area, etc.)
- ✅ **react hooks** - useState, useEffect, useMemo, etc.
- ❌ **plotly, d3, matplotlib** - Not allowed (sandboxing restrictions)

### Professional Color Palette

```typescript
const colors = {
  primary: '#3b82f6',      // Blue - main data
  secondary: '#6366f1',    // Indigo - secondary data
  tertiary: '#8b5cf6',     // Purple - tertiary data
  success: '#10b981',      // Emerald - positive/success
  warning: '#f59e0b',      // Amber - warnings
  danger: '#ef4444',       // Red - errors/critical
  muted: '#9ca3af'         // Gray - text/grid
};
```

### Example: Professional Bar Chart

```jsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function MetaboliteDistribution() {
  const data = [
    { metabolite: 'Glucose', concentration: 5.2 },
    { metabolite: 'Lactate', concentration: 1.8 },
    { metabolite: 'Pyruvate', concentration: 0.15 }
  ];

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">Metabolite Concentrations</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(156, 163, 175, 0.2)" />
          <XAxis
            dataKey="metabolite"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            label={{ value: 'Concentration (mM)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
          />
          <Bar dataKey="concentration" fill="#3b82f6" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated.

### Ways to Contribute

- 🐛 **Report bugs** - Found an issue? Let us know!
- ✨ **Request features** - Have an idea? We'd love to hear it!
- 📖 **Improve docs** - Help others get started
- 💻 **Submit PRs** - Code contributions welcome

### Development Workflow

1. **Fork the repository**

```bash
git clone https://github.com/yourusername/nulalabs.git
cd nulalabs
```

2. **Create a feature branch**

```bash
git checkout -b feature/amazing-feature
```

3. **Make your changes**
   - Follow existing code style
   - Add TypeScript types
   - Test thoroughly

4. **Commit with descriptive messages**

```bash
git commit -m "feat: add support for custom MCP servers"
```

5. **Push and create PR**

```bash
git push origin feature/amazing-feature
```

### Code Guidelines

- ✅ Use TypeScript for all new code
- ✅ Follow existing component patterns
- ✅ Add comments for complex logic
- ✅ Keep functions focused and small
- ✅ Test with multiple MCP servers

---

## 📄 License

MIT © NulaLabs Contributors

See [LICENSE](LICENSE) for full details.

---

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- [Next.js](https://nextjs.org) - React framework
- [Anthropic Claude](https://anthropic.com) - AI language model
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Radix UI](https://radix-ui.com) - UI components
- [Recharts](https://recharts.org) - Visualization library
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Vercel AI SDK](https://sdk.vercel.ai) - AI streaming

Special thanks to the open-source community!

---

## 📚 Resources

- **Documentation**
  - [Model Context Protocol Docs](https://modelcontextprotocol.io)
  - [Next.js Documentation](https://nextjs.org/docs)
  - [Anthropic API Docs](https://docs.anthropic.com)

- **Community**
  - [GitHub Discussions](https://github.com/yourusername/nulalabs/discussions)
  - [Issue Tracker](https://github.com/yourusername/nulalabs/issues)

- **Related Projects**
  - [mcp-use](https://github.com/mcp-use/mcp-use) - MCP framework
  - [SleepyRat](https://sleepyrat.ai) - Sleep analysis platform

---

## 🌟 Star History

If you find NulaLabs useful, please consider giving it a star on GitHub!

---

**Built with ❤️ for the research community**

*Transform your data analysis workflow today with NulaLabs*
