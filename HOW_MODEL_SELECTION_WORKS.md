# How Multi-Model Selection Works

## Overview: What Happens When You Select a Different Model?

When you select a model from the dropdown in Nula Labs, you're choosing which AI "brain" will process your questions and interact with your data analysis tools. **All models have access to the same MCP tools** - the only difference is the model's reasoning capabilities and domain knowledge.

---

## The Architecture in Simple Terms

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Model Selector Dropdown:                                 │   │
│  │    🧠 Claude Sonnet 4.5 (selected) ▼                      │   │
│  │    ⚡ Claude Haiku 3.5                                     │   │
│  │    🧬 Biomni-R0 (Beta)                                     │   │
│  │    🤖 GPT-4o                                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                    User sends message
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API Route                          │
│  1. Receives: { messages, modelId: "biomni-r0" }                │
│  2. Validates model is available                                │
│  3. Creates model provider (Anthropic/OpenAI/Biomni)            │
│  4. Loads ALL MCP tools (same for every model!)                 │
│  5. Streams response from selected model                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Model Provider Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Anthropic  │  │     OpenAI   │  │    Biomni    │          │
│  │              │  │              │  │ (OpenAI-like)│          │
│  │ Claude API   │  │   GPT API    │  │  SGLang API  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                  Model processes query
                  Model calls MCP tools
                  Model analyzes results
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                       MCP Tools Layer                           │
│  (Shared by ALL models - no changes needed!)                   │
│                                                                 │
│  biocontext_kb__bc_get_uniprot_protein_info                     │
│  biocontext_kb__bc_search_studies                               │
│  biocontext_kb__bc_get_europepmc_articles                       │
│  ... 50+ more tools ...                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## What Selecting Each Model Does

### 🧠 **Claude Sonnet 4.5** (Default)

**When you select this:**
- Backend creates: `anthropic('claude-sonnet-4-5')`
- API call goes to: Anthropic's servers
- Cost: $3 input / $15 output per 1M tokens

**Best for:**
- Complex multi-step analysis workflows
- Strategic planning and reasoning
- Interpreting complex statistical results
- Generating comprehensive visualizations

**Technical details:**
- Uses Anthropic API directly via `@ai-sdk/anthropic`
- Supports streaming responses
- Full tool calling support (all 50+ MCP tools)
- 200K context window
- Prompt caching enabled (saves costs on repeated queries)

---

### ⚡ **Claude Haiku 3.5** (Fast & Cheap)

**When you select this:**
- Backend creates: `anthropic('claude-haiku-3-5')`
- API call goes to: Anthropic's servers (same as Sonnet)
- Cost: $0.25 input / $1.25 output per 1M tokens (12x cheaper!)

**Best for:**
- Quick lookups and simple queries
- Data exploration before deep analysis
- Testing queries without burning budget
- Simple visualizations

**Technical details:**
- Same API infrastructure as Sonnet
- Faster response time (~2-3x)
- Same tool access (all MCP tools work)
- Smaller context window but sufficient for most tasks

---

### 🧬 **Biomni-R0** (Biology Specialist) 🔬

**When you select this:**
- Backend creates: `createOpenAI({ baseURL: 'http://localhost:30000/v1' })('biomni-r0')`
- API call goes to: **Your local machine** (SGLang server)
- Cost: **FREE** (self-hosted, uses your GPU/CPU)

**What makes it special:**
- **Pre-trained on biology literature**: Understands metabolomics, genomics, proteomics terminology natively
- **Domain-specific reasoning**: Better at experimental design, pathway analysis
- **Same tool access**: Uses ALL the same MCP tools as Claude (no limitations!)
- **Reinforcement Learning from Agent Interaction Data (RLAID)**: Trained specifically for tool use

**Best for:**
- Complex biological reasoning (TCA cycle, metabolic pathways)
- Experimental design in metabolomics/genomics
- Interpreting biological significance of results
- Domain-specific literature understanding

**Technical details:**
- Runs on **your local machine** via SGLang server
- Uses OpenAI-compatible API format (works seamlessly with our system)
- Tool calling via `--tool-call-parser qwen25` flag
- Model size: ~7-14B parameters (need to verify exact size)
- Requires GPU for good performance (CPU works but slower)

**What happens if Biomni server isn't running?**
```javascript
// Backend detects connection failure
if (!modelAvailable) {
  console.warn('Biomni-R0 unavailable - falling back to Claude Sonnet')
  model = createModelProvider('claude-sonnet-4-5') // Graceful fallback
}
```
- User sees no error (graceful degradation)
- Response comes from Claude Sonnet instead
- Console logs show the fallback happened

---

### 🤖 **GPT-4o** (Multimodal)

**When you select this:**
- Backend creates: `openai('gpt-4o')`
- API call goes to: OpenAI's servers
- Cost: $2.50 input / $10 output per 1M tokens

**Best for:**
- Vision tasks (analyzing charts, images) - *UI support coming soon*
- General-purpose reasoning
- Multimodal understanding

**Technical details:**
- Uses `@ai-sdk/openai` package
- Requires `OPENAI_API_KEY` environment variable
- Full tool calling support
- 128K context window

---

## What Stays the SAME Regardless of Model?

### ✅ **Tools (MCP Servers)**

**All models get access to:**
```javascript
biocontext_kb__bc_get_uniprot_protein_info
biocontext_kb__bc_search_studies
biocontext_kb__bc_get_europepmc_articles
biocontext_kb__bc_get_recruiting_studies_by_location
... 50+ more tools ...
```

**Why?** Tools are loaded from MCP servers **before** the model is called:

```typescript
// From src/app/api/chat/route.ts
const mcpClient = await getMCPClient();
const sessions = mcpClient.getAllActiveSessions();
const tools = await convertMCPToolsToAISDK(sessions);
// ^ This happens ONCE, shared by all models

// Then model gets the tools:
streamText({
  model,  // <- Any model (Claude, Biomni, GPT)
  tools,  // <- Same tools for everyone!
  messages
})
```

### ✅ **System Prompt**

All models receive the same instructions:
- Use MCP tools to get data
- Wait for tool results before answering
- Generate visualizations with recharts only
- Follow specific color palette

### ✅ **Conversation Context**

- Previous messages preserved
- Tool call history maintained
- Loaded datasets tracked
- Session context injected

### ✅ **Features**

- Streaming responses
- Workflow visualization
- Strategic planning
- Lab notebook
- Artifact rendering
- Download capabilities

---

## The Real Difference: The "Brain" Not The "Hands"

Think of it like this:

```
Model Selection = Choosing the Brain
MCP Tools = The Hands (always the same)

Claude Sonnet:   🧠 + 🛠️ → Generalist reasoning + tools
Claude Haiku:    ⚡ + 🛠️ → Fast reasoning + tools
Biomni-R0:       🧬 + 🛠️ → Biology expert + tools
GPT-4o:          🤖 + 🛠️ → Multimodal + tools
```

**All models:**
- Call `biocontext_kb__bc_get_uniprot_protein_info` the same way
- Get back the same protein data
- Have access to the same 50+ tools

**The difference:**
- How they interpret the results
- What questions they ask next
- How they design multi-step workflows
- Domain-specific knowledge they bring

---

## Example: Same Query, Different Models

**User asks:** "Analyze the role of citric acid in cellular metabolism"

### Claude Sonnet Response:
```
1. Calls biocontext_kb__bc_get_pathway_info('TCA cycle')
2. Interprets results with general biochemistry knowledge
3. Generates comprehensive explanation
4. Creates visualization showing TCA cycle steps
```

### Biomni-R0 Response:
```
1. Calls biocontext_kb__bc_get_pathway_info('TCA cycle')
2. Interprets results with SPECIALIZED biology knowledge
   - Recognizes connection to oxidative phosphorylation
   - Understands tissue-specific variations
   - Knows experimental techniques for measuring intermediates
3. Generates biology-focused explanation with domain insights
4. Creates visualization with biological context
```

**Same tools, different expertise!**

---

## Biomni-R0 Deep Dive: Why It's Special

### What Is Biomni-R0?

- **A specialized biology AI model** trained on scientific literature
- **Open-source** (self-hostable, no API costs)
- **Optimized for tool use** via RLAID training
- **OpenAI-compatible** (works with our existing infrastructure)

### How Does It Work Locally?

```bash
# You run a server on your machine:
python -m sglang.launch_server \
  --model-path /path/to/biomni-r0 \
  --port 30000 \
  --tool-call-parser qwen25  # Enables function calling

# Server exposes OpenAI-like API:
# http://localhost:30000/v1/chat/completions
```

**What happens when you select Biomni-R0:**

1. **Frontend:** User selects "🧬 Biomni-R0" from dropdown
2. **State update:** `setSelectedModel('biomni-r0')`
3. **API call:** Frontend sends `{ messages, modelId: 'biomni-r0' }`
4. **Backend routing:**
   ```typescript
   const config = getModelById('biomni-r0')
   // config.provider = 'biomni'
   // config.endpoint = 'http://localhost:30000/v1'

   const biomniProvider = createOpenAI({
     baseURL: 'http://localhost:30000/v1',
     apiKey: 'EMPTY'  // No API key needed for local
   })
   const model = biomniProvider('biomni-r0')
   ```
5. **Model execution:** Request goes to **your local SGLang server**
6. **Tool calling:** Biomni calls MCP tools just like Claude does
7. **Response:** Streamed back through same infrastructure

### Advantages of Biomni-R0

✅ **Free**: No API costs (just electricity for your GPU)
✅ **Private**: Data never leaves your machine
✅ **Specialized**: Better biology reasoning than general models
✅ **Full tool access**: Same 50+ MCP tools as Claude
✅ **OpenAI-compatible**: Works seamlessly with our code

### Requirements

- **Model weights**: Download Biomni-R0 model (~7-14GB)
- **SGLang server**: Python package for running the model
- **Hardware**: GPU recommended (works on CPU but slower)
- **Environment variables**:
  ```bash
  BIOMNI_URL=http://localhost:30000/v1
  BIOMNI_API_KEY=EMPTY
  ```

---

## How to Test Model Differences

### Quick Test: Ask the Same Question to Each Model

1. **Select Claude Haiku** (fast baseline)
   - Ask: "What is the TCA cycle?"
   - Note: Speed, brevity, general knowledge

2. **Select Claude Sonnet** (complex reasoning)
   - Ask: "What is the TCA cycle?"
   - Note: Depth, reasoning, comprehensive explanation

3. **Select Biomni-R0** (if running)
   - Ask: "What is the TCA cycle?"
   - Note: Domain-specific insights, experimental context

**Expected differences:**
- **Haiku**: 2-3 paragraphs, general explanation, fast
- **Sonnet**: 5+ paragraphs, detailed steps, connections
- **Biomni-R0**: Biological context, experimental techniques, pathway connections

---

## Cost Comparison: Real Examples

**Query:** "Analyze this metabolomics dataset" (10K input tokens, 5K output)

| Model | Input Cost | Output Cost | Total | Time |
|-------|-----------|-------------|-------|------|
| Haiku | $0.0025 | $0.0063 | **$0.0088** | ~5s |
| Sonnet | $0.03 | $0.075 | **$0.105** | ~15s |
| GPT-4o | $0.025 | $0.05 | **$0.075** | ~10s |
| Biomni-R0 | $0 | $0 | **$0** | ~20s |

**For 100 similar queries:**
- Haiku: $0.88
- Sonnet: $10.50
- GPT-4o: $7.50
- Biomni-R0: **$0** (electricity ~$0.10)

---

## Model Selection Best Practices

### Start with Haiku for:
- Quick data exploration
- Simple lookups
- Testing queries
- Budget-conscious work

### Use Sonnet for:
- Complex analysis workflows
- Strategic planning
- Multi-step reasoning
- High-stakes analysis

### Use Biomni-R0 for:
- Domain-specific biology questions
- When you have the server running
- Privacy-sensitive data
- Extensive analysis (no API costs)

### Use GPT-4o for:
- Multimodal tasks (coming soon)
- When you prefer OpenAI
- Alternative to Anthropic

---

## Technical Implementation Details

### Backend Model Routing (`src/app/api/chat/route.ts`)

```typescript
// 1. Extract model ID from request
const { messages, modelId } = await request.json()
const selectedModelId = modelId || getDefaultModel().id

// 2. Validate model configuration
const modelConfig = getModelById(selectedModelId)
if (!modelConfig || modelConfig.status === 'unavailable') {
  // Fallback to default
  model = createModelProvider(getDefaultModel().id)
} else {
  // Create selected model provider
  model = createModelProvider(selectedModelId)
}

// 3. Load tools (SAME FOR ALL MODELS)
const tools = await convertMCPToolsToAISDK(sessions)

// 4. Stream response
return streamText({ model, tools, messages })
```

### Provider Factory (`src/lib/models/provider-factory.ts`)

```typescript
export function createModelProvider(modelId: string): LanguageModel {
  const config = getModelById(modelId)

  switch (config.provider) {
    case 'anthropic':
      return anthropic(modelId)  // Claude models

    case 'openai':
      return openai(modelId)  // GPT models

    case 'biomni':
      // OpenAI-compatible local server
      const biomniProvider = createOpenAI({
        baseURL: config.endpoint,  // http://localhost:30000/v1
        apiKey: 'EMPTY'
      })
      return biomniProvider(modelId)

    case 'custom':
      // Any other OpenAI-compatible endpoint
      const customProvider = createOpenAI({
        baseURL: config.endpoint,
        apiKey: process.env[config.apiKeyEnv]
      })
      return customProvider(modelId)
  }
}
```

---

## Summary: What You Need to Know

1. **Model selection changes the "brain" not the "hands"**
   - All models access the same MCP tools
   - Difference is in reasoning, not capabilities

2. **Biomni-R0 is a local, specialized biology model**
   - Runs on your machine (no API costs)
   - Better at biology-specific reasoning
   - Requires SGLang server to be running
   - Falls back to Claude if unavailable

3. **The UI makes model selection prominent**
   - Dropdown always visible in header
   - Shows model icon, name, and badges
   - Easy to switch between models

4. **Cost vs. Performance trade-offs**
   - Haiku: Cheapest, fastest, good enough for most
   - Sonnet: Most capable, expensive, best reasoning
   - Biomni-R0: Free, specialized, requires setup
   - GPT-4o: Alternative, multimodal (soon)

5. **All models are production-ready**
   - Streaming responses work
   - Tool calling tested
   - Error handling with graceful fallbacks
   - Conversation context preserved

**Bottom line:** Pick the model that matches your task complexity, budget, and domain needs. The system handles the rest!
