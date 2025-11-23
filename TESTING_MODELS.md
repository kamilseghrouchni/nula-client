# Testing Multi-Model Selection

This guide explains how to test each available model in the system.

## Current Status: What You Can Test Right Now

### ✅ Ready to Test (API Keys Configured)

1. **Claude Sonnet 4.5** (Default)
   - ✅ API Key: Configured (`ANTHROPIC_API_KEY`)
   - 🎯 Best for: Complex analysis, multi-step workflows
   - 💰 Cost: $3/$15 per 1K tokens (input/output)

2. **Claude Haiku 3.5**
   - ✅ API Key: Same Anthropic key works
   - 🎯 Best for: Fast queries, simple lookups
   - 💰 Cost: $0.25/$1.25 per 1K tokens (cheap!)

### ⚠️ Requires Additional Setup

3. **Biomni-R0** (Biology Specialist)
   - ❌ Server not running
   - 📋 **What you need:**
     ```bash
     # 1. Set the API endpoint (add to .env.local)
     BIOMNI_URL=http://localhost:30000/v1
     BIOMNI_API_KEY=EMPTY  # Or your actual API key

     # 2. Start the Biomni-R0 server with SGLang
     # (Assuming you have the model and SGLang installed)
     python -m sglang.launch_server \
       --model-path /path/to/biomni-r0 \
       --port 30000 \
       --host 0.0.0.0 \
       --tool-call-parser qwen25
     ```
   - 🎯 Best for: Genomics, metabolomics, experimental design
   - 💰 Cost: Free (self-hosted)

4. **GPT-4o** (Multimodal)
   - ❌ API Key not configured
   - 📋 **What you need:**
     ```bash
     # Add to .env.local
     OPENAI_API_KEY=sk-your-openai-api-key-here
     ```
   - 🎯 Best for: Vision tasks, analyzing images/charts
   - 💰 Cost: $2.50/$10 per 1K tokens

---

## Quick Start: Test Right Now!

You can immediately test **Claude Sonnet 4.5** and **Claude Haiku 3.5** since your Anthropic API key is already configured.

### Step 1: Start the Dev Server

```bash
npm run dev
```

### Step 2: Open the App

Navigate to: http://localhost:3000/chat

### Step 3: Test Model Selection

1. **Look for the Model Selector** in the top-right corner of the chat interface
   - It's a dropdown button showing the current model icon and name
   - Default: 🧠 Claude Sonnet 4.5

2. **Click the dropdown** to see all available models:
   - 🧠 Claude Sonnet 4.5 (Default)
   - ⚡ Claude Haiku 3.5
   - 🧬 Biomni-R0 (Beta) - will show but won't work until server is running
   - 🤖 GPT-4o - will show but won't work until API key is added

3. **Select a model** (try Claude Haiku 3.5 for a quick test)

4. **Send a message** - for example:
   ```
   What is metabolomics?
   ```

5. **Check the browser console** (F12 → Console tab):
   - Look for: `[Model Selection] Using model: claude-haiku-3-5`
   - This confirms the model selection is working

---

## Testing Each Model

### Test 1: Claude Haiku (Fast & Cheap)

**Goal:** Verify model switching works and responses are fast

```bash
# 1. Select "Claude Haiku 3.5" from dropdown
# 2. Ask a simple question:
```
*Example query:*
> What are the main steps in metabolomic data analysis?

**Expected:**
- ✅ Fast response (< 5 seconds)
- ✅ Console shows: `[Model Selection] Using model: claude-haiku-3-5`
- ✅ Response is concise and accurate

---

### Test 2: Claude Sonnet (Default - Complex Reasoning)

**Goal:** Verify default model handles complex queries

```bash
# 1. Select "Claude Sonnet 4.5" from dropdown (or leave as default)
# 2. Ask a complex question:
```
*Example query:*
> Design a multi-step workflow for analyzing untargeted metabolomics data, including QC, normalization, and statistical testing.

**Expected:**
- ✅ Detailed, structured response with multiple steps
- ✅ Console shows: `[Model Selection] Using model: claude-sonnet-4-5`
- ✅ May use tools (MCP) if you have data loaded

---

### Test 3: Biomni-R0 (Specialist - Requires Setup)

**Prerequisites:**
1. Install SGLang and download Biomni-R0 model
2. Start the server (see "Requires Additional Setup" above)
3. Add `BIOMNI_URL` to `.env.local`

**Goal:** Test biology-specialized model with domain knowledge

```bash
# 1. Select "Biomni-R0" from dropdown
# 2. Ask a specialized biology question:
```
*Example query:*
> Explain the role of citric acid in the TCA cycle and its metabolic significance.

**Expected:**
- ✅ Specialized biological reasoning
- ✅ Console shows: `[Model Selection] Using model: biomni-r0`
- ✅ Domain-specific insights

**If it fails:**
- ❌ Check server is running: `curl http://localhost:30000/v1/models`
- ❌ Check console for connection errors
- ✅ System should auto-fallback to Claude Sonnet with warning in console

---

### Test 4: GPT-4o (Multimodal - Requires API Key)

**Prerequisites:**
1. Add `OPENAI_API_KEY` to `.env.local`
2. Restart dev server

**Goal:** Test OpenAI integration (vision support not yet implemented in UI)

```bash
# 1. Select "GPT-4o" from dropdown
# 2. Ask a general question:
```
*Example query:*
> What are the key differences between PCA and t-SNE for dimensionality reduction?

**Expected:**
- ✅ GPT-4o response
- ✅ Console shows: `[Model Selection] Using model: gpt-4o`

---

## Debugging Tips

### Check Model Selection in Console

Open browser DevTools (F12) and watch the Console tab:

```javascript
// When you send a message, you should see:
[Model Selection] Using model: <selected-model-id>
[Model Selection] Successfully created provider for: <selected-model-id>

// If model is unavailable:
[Model Selection] Model unavailable: <model-id> - falling back to default
```

### Check Backend Logs

In your terminal where `npm run dev` is running:

```bash
# Should see logs like:
[Model Selection] Using model: claude-haiku-3-5
[Chat] 🔧 Added 15 synthetic tools for MCP resources/prompts
[Token Management] Final context: 15234 tokens
```

### Test Fallback Behavior

**Scenario:** Select Biomni-R0 without server running

**Expected:**
1. UI shows "Biomni-R0" selected
2. Backend logs: `Model unavailable: biomni-r0 - falling back to default`
3. Response comes from Claude Sonnet (default)
4. No error shown to user (graceful degradation)

---

## What Works Now vs. Later

### ✅ Working Right Now

- Model selection UI dropdown
- Claude Sonnet 4.5 (default)
- Claude Haiku 3.5
- Automatic fallback if model unavailable
- Tool calling with MCP servers (all models)
- Streaming responses

### 🚧 Requires Environment Setup

- **Biomni-R0**: Need to run SGLang server locally
- **GPT-4o**: Need OpenAI API key

### 🔮 Future Enhancements (Not Implemented Yet)

- Vision support for GPT-4o (image uploads)
- Model-specific system prompts
- Per-model token limit handling
- Model performance metrics in UI
- Model cost tracking

---

## Quick Environment Setup

### For Biomni-R0 (Optional)

```bash
# Add to .env.local
echo 'BIOMNI_URL=http://localhost:30000/v1' >> .env.local
echo 'BIOMNI_API_KEY=EMPTY' >> .env.local

# Then start the Biomni server in a separate terminal
# (requires SGLang and model weights)
```

### For GPT-4o (Optional)

```bash
# Add to .env.local
echo 'OPENAI_API_KEY=sk-your-key-here' >> .env.local

# Restart dev server
npm run dev
```

---

## Success Criteria

A successful test means:

1. ✅ Model selector appears in chat UI header
2. ✅ Dropdown shows all 4 models with icons
3. ✅ Clicking a model updates the selection
4. ✅ Sending a message uses the selected model
5. ✅ Console logs confirm correct model is used
6. ✅ Response is streamed back successfully
7. ✅ Tool calling works (if applicable)
8. ✅ Fallback works if model unavailable

---

## Next Steps After Testing

Once you've tested the basic model selection:

1. **Add more models** - Follow `ADDING_MODELS.md` guide (coming soon)
2. **Configure Biomni-R0** - Set up the biology specialist
3. **Add OpenAI key** - Enable GPT-4o multimodal
4. **Monitor costs** - Check API usage for different models
5. **Optimize prompts** - Model-specific system prompts for better results
