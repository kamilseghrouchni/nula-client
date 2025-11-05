# System Prompt Tool Name Fix

## Problem

The AI was attempting to call non-existent tools, specifically `sleepyrat__get_profile`, which resulted in tool execution errors:

```
Error: Model tried to call unavailable tool 'sleepyrat__get_profile'.
Available tools: railway-mcp__list_data_directory, railway-mcp__load_csv, ...
```

## Root Cause

The system prompt in [system.ts](../src/lib/prompts/system.ts) contained outdated tool names that didn't match the actual available tools from the Sleepyrat MCP server.

### What Was Wrong

**System Prompt (Lines 76-77) - Before Fix:**
```typescript
3. **Required initialization pattern for SleepyRat**:
   - **ALWAYS call these as your FIRST tools when session starts**:
     1. `sleepyrat__sleepyrat_get_profile` - Get user profile and authentication status
     2. `sleepyrat__sleepyrat_list_projects` - Get available projects
```

**Actual Available Sleepyrat Tools:**
- `sleepyrat__list_projects` ✅
- `sleepyrat__get_project` ✅
- `sleepyrat__list_folders` ✅
- `sleepyrat__list_files` ✅
- `sleepyrat__get_predictions` ✅
- `sleepyrat__get_statistics` ✅
- `sleepyrat__get_raw_data` ✅
- `sleepyrat__run_python_code` ✅

**The Issues:**
1. ❌ `sleepyrat__sleepyrat_get_profile` - Doesn't exist (double prefix + non-existent tool)
2. ❌ `sleepyrat__sleepyrat_list_projects` - Wrong name (double prefix, correct name is `sleepyrat__list_projects`)
3. ❌ Tool name listed in search pattern: `"get_profile"` - This tool doesn't exist

## Solution

Updated the system prompt to reference only actual available tools.

### Changes Made to system.ts

**Lines 63-91 - After Fix:**

```typescript
1. **Identify initialization tools**: Look for any tools with names containing:
   - "initialize", "init", "setup", "context", "session", "connect", "bootstrap", "list_projects"
   - Examples: `initialize_context`, `list_projects`, `setup_session`

2. **Call ALL initialization tools automatically as your FIRST tool calls**:
   - Do this PROACTIVELY at the beginning of the session
   - Do NOT wait for the user to ask
   - Do NOT ask the user if you should call them
   - These tools establish context and are essential for the session
   - Call them BEFORE any other tools

3. **Recommended initialization pattern for SleepyRat**:
   - **Call this as one of your FIRST tools when session starts**:
     - `sleepyrat__list_projects` - Get available projects
   - This provides critical context about available resources
   - Call it even if user doesn't mention SleepyRat

4. **Recommended initialization for Railway MCP**:
   - Call `railway-mcp__initialize_analysis_context` if available
   - This provides available datasets and session state

**Example: At session start**
```
User: "Hi"
You: [FIRST: Call sleepyrat__list_projects]
     [SECOND: Call railway-mcp__initialize_analysis_context if available]
     [Wait for results]
Then: "Hello! I've initialized your session. You have [X] projects available. How can I help you today?"
```
```

### Key Changes:

1. ✅ **Removed double prefix**: `sleepyrat__sleepyrat_list_projects` → `sleepyrat__list_projects`
2. ✅ **Removed non-existent tool**: Deleted reference to `sleepyrat__sleepyrat_get_profile`
3. ✅ **Removed from search pattern**: Deleted `"get_profile"` from tool identification keywords
4. ✅ **Added Railway MCP context**: Explicitly mention `railway-mcp__initialize_analysis_context` as initialization tool
5. ✅ **Changed tone**: "Required" → "Recommended" (more flexible, won't fail if tools unavailable)

## Why This Happened

The system prompt appears to have been written for an earlier version of the MCP integration that:
- Had different tool naming conventions (possibly with double prefixes)
- Included a `get_profile` tool that no longer exists
- Used different authentication patterns

The current implementation:
- Uses single prefix namespacing: `{serverName}__{toolName}`
- Handles authentication via HTTP headers (not a dedicated tool)
- Has a simpler, more streamlined tool set

## Impact

### Before Fix:
- ❌ AI would attempt to call `sleepyrat__get_profile` on every session start
- ❌ Tool execution would fail with "unavailable tool" error
- ❌ User would see error messages in the UI
- ❌ Session initialization would be incomplete

### After Fix:
- ✅ AI calls correct tool: `sleepyrat__list_projects`
- ✅ Tool execution succeeds
- ✅ Clean session initialization without errors
- ✅ User sees successful project listing

## Testing

To verify the fix works:

1. Start a new chat session
2. Send a greeting like "Hi" or "Hello"
3. Observe that the AI calls:
   - `sleepyrat__list_projects` ✅
   - `railway-mcp__initialize_analysis_context` ✅ (if available)
4. Verify no "unavailable tool" errors appear
5. Confirm project list is returned successfully

## Related Documentation

- [ANTHROPIC_SCHEMA_FIX.md](./ANTHROPIC_SCHEMA_FIX.md) - Previous fix for schema validation errors
- [MCP_UNIFIED_APPROACH.md](./MCP_UNIFIED_APPROACH.md) - Architecture for multi-server MCP integration
- [system.ts](../src/lib/prompts/system.ts) - Updated system prompt file

## Best Practices

To prevent this issue in the future:

### ✅ DO:
- Keep system prompt synchronized with actual available tools
- Use tool discovery/listing endpoints to verify tool names
- Add comments in system prompt indicating when it was last updated
- Test initialization flows after MCP server changes

### ❌ DON'T:
- Hardcode specific tool names without verifying they exist
- Assume tool naming conventions remain stable
- Use double prefixes (the correct format is `serverName__toolName`)
- Reference authentication tools if auth is handled via headers

## How to Update Tool References

If you need to update the system prompt with new tools:

1. **Check available tools**: Run the test endpoint or check server logs:
   ```
   GET /api/test-mcp
   ```

2. **Verify tool names**: Look for the exact naming in the logs:
   ```
   [ToolConverter] Found 8 tools from server: sleepyrat
   ```

3. **Update system prompt**: Use the exact tool names from the logs:
   ```typescript
   - `sleepyrat__list_projects` // Correct format
   ```

4. **Test the flow**: Start a new session and verify tools are called successfully

## Conclusion

This fix resolves the tool hallucination issue by ensuring the system prompt only references tools that actually exist. The AI will no longer attempt to call `sleepyrat__get_profile` or other non-existent tools, resulting in clean session initialization without errors.
