<div align="center">
  <img src="./public/banner.png" alt="NulaLabs - AI-Powered Data Analysis Platform" width="100%">

  <h1>🧬 NulaLabs</h1>

  <p align="center">
    <strong>Make your data accessible for AI agents.</strong><br/>
    Automate metabolomics analysis with ease.
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

**NulaLabs** transforms your data analysis workflow with an intelligent chat interface that connects to multiple MCP servers, provides visual workflow tracking, and generates publication-ready visualizations - all powered by Claude Sonnet 4.5.

Perfect for researchers, data scientists, and lab teams who want to:
- 🧬 **Automate metabolomics analysis** - From QC to pathway enrichment
- 😴 **Analyze sleep data** - Polysomnography, actigraphy, and more
- 📊 **Build reproducible workflows** - Visual documentation of every analysis step
- 🤝 **Collaborate on insights** - Share visualizations and workflows with your team

---

## 🎬 Demos

See NulaLabs in action analyzing real data:

<details open>
<summary><b>🧬 Metabolomics QC Analysis</b></summary>

> "Analyze the quality of my metabolomics data and show me the CV distribution"

<div align="center">
  <img src="./assets/demo-metabolomics.gif" alt="Metabolomics QC Analysis" width="800"/>
</div>

**What happens:**
1. AI connects to EDA-MCP server
2. Loads metabolomics dataset
3. Calculates CV for PooledQC samples
4. Generates interactive visualization
5. Creates workflow node: "QC Assessment"
6. Suggests next steps: "Would you like to see outlier detection?"

[👉 See full example](./examples/metabolomics-qc.md)

</details>

<details>
<summary><b>😴 Sleep Stage Analysis</b></summary>

> "Show me the sleep stage distribution for all recordings in project X"

<div align="center">
  <img src="./assets/demo-sleep.gif" alt="Sleep Analysis" width="800"/>
</div>

**What happens:**
1. AI connects to Sleepyrat MCP server
2. Lists available projects
3. Loads all recordings from selected project
4. Analyzes sleep stage distribution
5. Generates pie chart visualization
6. Creates workflow: "Data Loading → Analysis → Visualization"

[👉 See full example](./examples/sleep-analysis.md)

</details>

<details>
<summary><b>🔍 Multi-Server Workflow</b></summary>

> "Compare the metabolomics results with sleep quality metrics"

<div align="center">
  <img src="./assets/demo-multi-server.gif" alt="Multi-Server Analysis" width="800"/>
</div>

**What happens:**
1. AI coordinates between EDA-MCP and Sleepyrat servers
2. Loads metabolomics and sleep data in parallel
3. Performs correlation analysis
4. Generates combined visualization
5. Creates complex workflow graph
6. Tracks all data sources in session context

[👉 See full example](./examples/multi-server.md)

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
   "Analyze my metabolomics data"
   "Show sleep stage distribution"
   "Create a QC assessment plan"
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
    "railway-mcp": {
      "url": "https://kamilseghrouchni.up.railway.app/mcp",
      "transport": "http"
    },
    "sleepyrat": {
      "url": "https://sleepyrat.ai/api/mcp-tools",
      "transport": "http"
    }
  }
}
```

**All servers now use HTTP transport** - no local installations required!

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
