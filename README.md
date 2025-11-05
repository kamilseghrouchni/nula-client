<div align="center">
  <img src="./public/banner.png" alt="NulaLabs - AI-Powered Data Analysis Platform" width="100%">

  <h1>🧬 NulaLabs</h1>

  <p align="center">
    <strong>Universal MCP client for biological data analysis.</strong><br/>
    Connect your analysis tools, empower scientists with AI.
  </p>

  <p align="center">
    <a href="https://github.com/kristerus/nulalabs/stargazers">
      <img src="https://img.shields.io/github/stars/kristerus/nulalabs?style=for-the-badge&logo=github&color=yellow" alt="GitHub Stars"/>
    </a>
    <a href="https://github.com/kristerus/nulalabs/network/members">
      <img src="https://img.shields.io/github/forks/kristerus/nulalabs?style=for-the-badge&logo=github&color=blue" alt="GitHub Forks"/>
    </a>
    <a href="https://github.com/kristerus/nulalabs/blob/main/LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge" alt="License"/>
    </a>
  </p>

  <p align="center">
    <a href="https://nextjs.org">
      <img src="https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js" alt="Next.js"/>
    </a>
    <a href="https://react.dev">
      <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react" alt="React"/>
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript" alt="TypeScript"/>
    </a>
    <a href="https://modelcontextprotocol.io">
      <img src="https://img.shields.io/badge/MCP-2024--11--05-purple?style=flat-square" alt="MCP"/>
    </a>
  </p>

  <p align="center">
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-demos">Demos</a> •
    <a href="#-features">Features</a> •
    <a href="#-documentation">Documentation</a> •
    <a href="#-community">Community</a>
  </p>

</div>

---

## 💡 What is NulaLabs?

**NulaLabs** is a universal MCP (Model Context Protocol) client built for biological data analysis. It provides an intelligent chat interface powered by Claude Sonnet 4.5 (Anthropic) that connects to unlimited MCP servers, tracks analysis workflows visually, and generates publication-ready visualizations.

### 👥 Who is it for?

**For Scientists & Researchers:**
- Ask questions about your data in natural language
- No programming required - just chat
- Get instant visualizations and statistical analysis
- Reproducible workflows automatically documented

**For Bioinformaticians & CROs:**
- Expose your analysis functions as MCP servers
- Scale your expertise to multiple scientists simultaneously
- No need to build custom UIs for each tool
- Scientists can query data independently

**For Contract Research Organizations:**
- Provide clients with self-service data analysis
- Maintain control over analysis logic (server-side)
- Track all analysis workflows for compliance
- Professional visualizations for client reports

---

## 🚀 Powered by mcp-use

NulaLabs is built on **[mcp-use](https://github.com/mcp-use/mcp-use)**, the TypeScript framework that makes MCP integration seamless.

### Why mcp-use?

**Multi-Server Management Made Simple:**
```typescript
// Connect to unlimited servers with one line
const client = MCPClient.fromDict(config);
await client.createAllSessions();
```

**Key Benefits We Leverage:**

✅ **Simultaneous Multi-Server Connections**
- Connect to ALL your analysis servers at once
- No manual client instantiation per server
- Automatic tool discovery and namespacing

✅ **Graceful Degradation**
- System continues if one server fails
- Perfect for production environments
- Built-in error handling

✅ **Simplified Authentication**
- Automatic `Bearer` token injection from `authToken` field
- Custom HTTP headers support
- Runtime environment variable resolution

✅ **Transport Flexibility**
- HTTP and STDIO transports in single config
- Switch between local and remote servers seamlessly
- No code changes needed

✅ **Developer Experience**
- TypeScript-first with full type safety
- Simple JSON configuration
- Comprehensive documentation

### Real-World Impact

Before mcp-use, managing multiple MCP servers required:
- Separate client instances per server
- Manual tool merging logic
- Complex error handling
- Custom authentication wrappers

**With mcp-use:**
```json
{
  "mcpServers": {
    "server1": { "url": "https://api1.com/mcp" },
    "server2": { "url": "https://api2.com/mcp" }
  }
}
```
Done. All servers connected, tools merged, ready to use.

[Learn more about mcp-use →](https://github.com/mcp-use/mcp-use)

---

## 🎬 Demos

See NulaLabs in action with different types of biological data:

<details open>
<summary><b>🧬 Quality Control Analysis</b></summary>

> "Analyze the quality of my data and show me the CV distribution"

<div align="center">
  <img src="./assets/demo-qc-analysis.gif" alt="QC Analysis Workflow" width="800"/>
</div>

**What happens:**
1. AI connects to your analysis server
2. Loads dataset from configured data source
3. Calculates quality metrics (CV, reproducibility, etc.)
4. Generates interactive visualization
5. Creates workflow node: "QC Assessment"
6. Suggests next steps based on results

**Server Type:** Any MCP server with statistical analysis tools

</details>

<details>
<summary><b>📊 Exploratory Data Analysis</b></summary>

> "Show me the distribution of my samples across conditions"

<div align="center">
  <img src="./assets/demo-eda.gif" alt="EDA Workflow" width="800"/>
</div>

**What happens:**
1. AI connects to your EDA server
2. Lists available datasets/projects
3. Loads selected data
4. Performs statistical analysis
5. Generates appropriate visualizations (bar, pie, scatter, etc.)
6. Creates workflow: "Data Loading → Analysis → Visualization"

**Server Type:** Any MCP server with data exploration capabilities

</details>

<details>
<summary><b>🔍 Multi-Server Workflow</b></summary>

> "Compare results from multiple data sources"

<div align="center">
  <img src="./assets/demo-multi-server.gif" alt="Multi-Server Analysis" width="800"/>
</div>

**What happens:**
1. AI coordinates between multiple MCP servers
2. Loads data from different sources in parallel
3. Performs cross-server analysis
4. Generates combined visualizations
5. Creates complex workflow graph
6. Tracks all data sources in session context

**Server Type:** Multiple MCP servers (e.g., proteomics + metabolomics, clinical + omics)

</details>

---

## ⚡ Quick Start

Get started in **under 2 minutes**:

### 🤖 For AI Agents

Direct your favorite coding agent to [Quick Start Guide](#installation) below. Our system prompt is designed to work seamlessly with:
- Cursor
- Windsurf
- Aider
- Cline

### 👋 For Humans

1. **Install dependencies**
   ```bash
   git clone https://github.com/kristerus/nulalabs.git
   cd nulalabs
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Add your ANTHROPIC_API_KEY
   ```

3. **Set up MCP servers**
   ```bash
   # Edit mcp-config.json with your server configurations
   ```

4. **Start the app**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

5. **Start analyzing!**
   ```
   "Analyze the quality of my data"
   "Show me the distribution across samples"
   "Create an analysis plan for this dataset"
   ```

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

## 🎯 Why NulaLabs?

<table>
<tr>
<td width="50%" valign="top">

### 🚀 **Traditional Workflow**
1. Open multiple analysis tools
2. Copy-paste data between applications
3. Write custom scripts for each analysis
4. Manually track analysis steps
5. Recreate visualizations for publication
6. Document workflow in separate file

⏱️ **Time:** 2-3 hours per analysis

</td>
<td width="50%" valign="top">

### ✨ **With NulaLabs**
1. Ask a question in natural language
2. AI coordinates all tools automatically
3. Analysis runs across multiple servers
4. Workflow tracked visually in real-time
5. Publication-ready charts generated
6. Complete documentation auto-created

⏱️ **Time:** 5-10 minutes per analysis

</td>
</tr>
</table>

### 📊 Comparison

| Feature | Traditional Tools | NulaLabs |
|---------|------------------|----------|
| **Multi-Server Access** | ❌ Switch between tools | ✅ One interface for all |
| **Workflow Documentation** | ❌ Manual tracking | ✅ Automatic visual graph |
| **AI Assistance** | ❌ No guidance | ✅ Expert suggestions |
| **Reproducibility** | ⚠️ Manual documentation | ✅ Built-in tracking |
| **Learning Curve** | ⚠️ Steep | ✅ Natural language |
| **Collaboration** | ⚠️ Share files manually | ✅ Share workflows easily |

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
# Required: Anthropic API Key (Claude Sonnet 4.5)
ANTHROPIC_API_KEY=sk-ant-your_api_key_here

# Optional: MCP Server Authentication (if your servers require auth)
# MY_SERVER_TOKEN=your_token_here
# ANOTHER_SERVER_TOKEN=another_token
```

**Note:** The `.env` file is gitignored and never committed to version control.

### Configure MCP Servers

Create `mcp-config.json` at the project root (copy from `mcp-config.example.json`):

**HTTP Server Example:**
```json
{
  "mcpServers": {
    "my-analysis-server": {
      "url": "https://your-server-url.com/mcp",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Local STDIO Server Example:**
```json
{
  "mcpServers": {
    "my-local-server": {
      "command": "npx",
      "args": ["-y", "@your-org/mcp-server", "/path/to/data"],
      "transport": "stdio",
      "env": {
        "CUSTOM_ENV_VAR": "value"
      }
    }
  }
}
```

**Multiple Servers Example:**
```json
{
  "mcpServers": {
    "eda-server": {
      "url": "https://eda.example.com/mcp",
      "transport": "http"
    },
    "stats-server": {
      "command": "python",
      "args": ["-m", "stats_mcp_server"],
      "transport": "stdio"
    }
  }
}
```

**Note:** `mcp-config.json` is gitignored and never committed to version control.

### Run the Application

```bash
# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

**That's it!** Start chatting with your AI assistant and analyze your data.

---

## 📋 Requirements & Compatibility

### AI Model Support
- **Primary:** Anthropic Claude Sonnet 4.5 (recommended)
- **API:** Anthropic API via `@ai-sdk/anthropic`
- **Why Anthropic?** Best-in-class reasoning, tool use, and scientific analysis capabilities

### MCP Compatibility
- **MCP Version:** 2024-11-05 specification
- **Framework:** mcp-use v1.2.2+
- **Transports:** HTTP and STDIO
- **Server Types:** Any MCP-compliant server

### Supported MCP Server Types
NulaLabs works with ANY MCP server that provides:
- ✅ Data loading/querying tools
- ✅ Statistical analysis functions
- ✅ Data transformation capabilities
- ✅ File system access (optional)

**Examples of compatible servers:**
- Biological data analysis servers (metabolomics, proteomics, genomics)
- Statistical analysis servers (R, Python-based)
- Database query servers (SQL, NoSQL)
- File system servers (for data access)
- Custom domain-specific servers built by your team

### Environment Requirements
- Node.js 20+
- npm or yarn
- Anthropic API key (get from [console.anthropic.com](https://console.anthropic.com))

---

## 📖 Usage Guide

### Basic Workflow

1. **Start a conversation** - Ask a question about your data
2. **AI initializes** - Automatically connects to MCP servers and loads tools
3. **Get insights** - Receive analysis, visualizations, and recommendations
4. **Track progress** - View workflow diagram in real-time
5. **Export results** - Download visualizations and workflow diagrams

### Example Conversations

**Quality Control Analysis:**
```
You: "Analyze the quality of my data"
AI: [Initializes session, connects to servers, loads data]
    "I've calculated quality metrics. Average CV is 12%..."
    [Workflow node created: "QC Assessment"]
    [Generates QC metrics visualization]
Follow-up: "Would you like to see outlier detection results?"
```

**Exploratory Data Analysis:**
```
You: "Show me the distribution across sample groups"
AI: [Lists available datasets, loads selected data]
    "Found 145 samples across 4 groups. Here's the distribution..."
    [Workflow node created: "Data Loading"]
    [Generates distribution visualization]
Follow-up: "Shall I perform statistical comparison between groups?"
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

## 🔬 For CROs & Bioinformaticians

### Building MCP Servers for Your Team

NulaLabs is designed to work with YOUR analysis functions. By exposing your tools as MCP servers, you can:

**Scale Your Expertise:**
- Write analysis code once
- Make it accessible to all scientists via natural language
- No need to build custom UIs for each tool
- Scientists work independently without bottlenecking your team

**Maintain Control:**
- Analysis logic stays server-side (your control)
- Scientists can't accidentally modify algorithms
- Easy to update tools without client changes
- Version control and reproducibility built-in

**Perfect for CROs:**
- Provide clients with self-service analysis
- Track all analysis workflows for compliance
- Professional visualizations for reports
- Maintain IP protection (server-side code)

### How to Create an MCP Server

**Option 1: Python (Recommended for Data Scientists)**
```python
from mcp import Server
import pandas as pd

server = Server("my-analysis-server")

@server.tool()
def calculate_stats(dataset_id: str) -> dict:
    """Calculate descriptive statistics for a dataset."""
    df = load_dataset(dataset_id)
    return {
        "mean": df.mean().to_dict(),
        "std": df.std().to_dict(),
        "n_samples": len(df)
    }

if __name__ == "__main__":
    server.run()
```

**Option 2: TypeScript/JavaScript**
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

const server = new Server({
  name: "my-analysis-server",
  version: "1.0.0"
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "calculate_stats",
    description: "Calculate descriptive statistics",
    inputSchema: { /* ... */ }
  }]
}));
```

**Deploy Your Server:**
- **Local:** Run via STDIO (perfect for desktop deployment)
- **Remote:** Deploy to Railway, Heroku, AWS Lambda
- **Containerized:** Docker for reproducible environments

### Integration Architecture

```
Scientists (NulaLabs Client)
         ↓
    Natural Language Query
         ↓
   Claude Sonnet 4.5
         ↓
    Your MCP Servers (HTTP/STDIO)
         ↓
    Your Analysis Functions
         ↓
    Your Data Sources
```

**Benefits:**
- Scientists ask questions in English
- AI translates to tool calls
- Your code executes server-side
- Results returned as JSON
- Visualizations generated automatically

### Example Use Cases

**Metabolomics Lab:**
```
Server Tools: load_data, calculate_cv, detect_outliers, pathway_analysis
Scientists ask: "What's the quality of batch 5?"
→ AI calls: calculate_cv(batch=5) → Returns: CV metrics
→ Generates: Interactive bar chart
```

**CRO Serving Pharma Clients:**
```
Server Tools: query_samples, run_stats, generate_report
Client asks: "Compare treatment vs control"
→ AI calls: query_samples(groups=["treatment","control"])
→ AI calls: run_stats(test="ttest")
→ Generates: Statistical comparison with p-values
```

**Genomics Pipeline:**
```
Server Tools: align_reads, call_variants, annotate
Researcher asks: "Run variant calling on sample X"
→ AI calls: align_reads(sample="X")
→ AI calls: call_variants(aligned_bam="X.bam")
→ Tracks: Complete workflow with each step
```

### Resources for Building Servers

- **MCP Documentation:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Example Servers:** [github.com/modelcontextprotocol](https://github.com/modelcontextprotocol)
- **mcp-use Framework:** [github.com/mcp-use/mcp-use](https://github.com/mcp-use/mcp-use)

---

## ⚙️ Configuration

### MCP Server Setup

Configuration examples are provided in the [Configure MCP Servers](#configure-mcp-servers) section above. Both HTTP and STDIO transports are supported.

### Environment Variables

```bash
# Required: Anthropic API for Claude Sonnet 4.5
ANTHROPIC_API_KEY=sk-ant-...

# Optional: MCP Server Tokens (if your servers require authentication)
# Use ${VARIABLE_NAME} syntax in mcp-config.json to reference these
MY_SERVER_TOKEN=your_token_here
ANOTHER_SERVER_TOKEN=another_token_here
```

**Security Note:** All environment variables are gitignored and never committed to version control.

---

## 🏗️ Architecture

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4 |
| **AI** | Anthropic Claude Sonnet 4.5 via `@ai-sdk/anthropic` |
| **MCP** | mcp-use v1.2.2 (built on @modelcontextprotocol/sdk) |
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
  - [mcp-use](https://github.com/mcp-use/mcp-use) - MCP client framework (powers NulaLabs)
  - [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification

---

## 💬 Community

<div align="center">

Join our growing community of researchers and developers!

[![GitHub Discussions](https://img.shields.io/badge/Discussions-Join-blue?style=for-the-badge&logo=github)](https://github.com/kristerus/nulalabs/discussions)
[![GitHub Issues](https://img.shields.io/badge/Issues-Report-red?style=for-the-badge&logo=github)](https://github.com/kristerus/nulalabs/issues)
[![Twitter Follow](https://img.shields.io/twitter/follow/nulalabs?style=for-the-badge&logo=twitter&color=1DA1F2)](https://twitter.com/nulalabs)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord)](https://discord.gg/nulalabs)

</div>

### 💡 **Get Help**
- 📖 [Read the Docs](https://docs.nulalabs.io)
- 💬 [Ask in Discussions](https://github.com/kristerus/nulalabs/discussions)
- 🐛 [Report a Bug](https://github.com/kristerus/nulalabs/issues/new?template=bug_report.md)
- ✨ [Request a Feature](https://github.com/kristerus/nulalabs/issues/new?template=feature_request.md)

### 🤝 **Contribute**
- 💻 [Submit a PR](https://github.com/kristerus/nulalabs/pulls)
- 📝 [Improve Docs](https://github.com/kristerus/nulalabs/tree/main/docs)
- 🌐 [Add Translations](https://github.com/kristerus/nulalabs/tree/main/locales)
- 🎨 [Share Examples](https://github.com/kristerus/nulalabs/tree/main/examples)

### 📢 **Stay Updated**
- ⭐ Star this repo to follow development
- 👀 Watch releases for new features
- 🔔 Subscribe to our newsletter (coming soon!)

---

## 🌟 Star History

If you find NulaLabs useful, **give us a star** on GitHub!

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=kristerus/nulalabs&type=Date)](https://star-history.com/#kristerus/nulalabs&Date)

</div>

---

## 📈 Project Stats

<div align="center">

![GitHub commit activity](https://img.shields.io/github/commit-activity/m/kristerus/nulalabs?style=flat-square)
![GitHub last commit](https://img.shields.io/github/last-commit/kristerus/nulalabs?style=flat-square)
![GitHub contributors](https://img.shields.io/github/contributors/kristerus/nulalabs?style=flat-square)
![GitHub issues](https://img.shields.io/github/issues/kristerus/nulalabs?style=flat-square)
![GitHub pull requests](https://img.shields.io/github/issues-pr/kristerus/nulalabs?style=flat-square)

</div>

---

## 🏆 Contributors

Thanks to these wonderful people who have contributed to NulaLabs:

<div align="center">

[![Contributors](https://contrib.rocks/image?repo=kristerus/nulalabs)](https://github.com/kristerus/nulalabs/graphs/contributors)

</div>

---

<div align="center">

**Built with ❤️ for the research community**

*Transform your data analysis workflow today with NulaLabs*

<p>
  <a href="https://github.com/kristerus/nulalabs">⭐ Star on GitHub</a> •
  <a href="https://docs.nulalabs.io">📖 Read the Docs</a> •
  <a href="https://twitter.com/nulalabs">🐦 Follow on Twitter</a>
</p>

</div>
