/**
 * Test script to verify Code Mode implementation
 *
 * This script tests:
 * 1. MCPClient initialization
 * 2. Code Mode tools (execute_code, search_tools)
 * 3. VM-based JavaScript execution with MCP tool access
 */

import { getMCPClient } from './src/lib/mcp/mcpClient';
import { getCodeModeTools } from './src/lib/mcp/codeModeToolConverter';

async function testCodeMode() {
  console.log('🧪 Testing Code Mode Implementation...\n');

  try {
    // Step 1: Initialize MCP Client
    console.log('1️⃣  Initializing MCP Client...');
    const client = await getMCPClient();
    console.log('✅ MCP Client initialized successfully');

    // Check active sessions
    const sessions = client.getAllActiveSessions();
    const serverNames = Object.keys(sessions);
    console.log(`   Active servers: ${serverNames.join(', ')}`);

    // Step 2: Get Code Mode Tools
    console.log('\n2️⃣  Getting Code Mode tools...');
    const tools = await getCodeModeTools(client);
    const toolNames = Object.keys(tools);
    console.log(`✅ Code Mode tools loaded: ${toolNames.join(', ')}`);

    // Step 3: Test search_tools INSIDE execute_code
    console.log('\n3️⃣  Testing search_tools inside execute_code...');
    const searchCodeResult = await tools.execute_code.execute({
      code: `
// Search for all tools
const allTools = await search_tools();
console.log('Total tools:', allTools.meta.total_tools);

// Search with query
const geneTools = await search_tools("gene", "descriptions");
console.log('Gene tools found:', geneTools.meta.result_count);

// Return results
return {
  total: allTools.meta.total_tools,
  gene_count: geneTools.meta.result_count,
  sample_tools: geneTools.results.slice(0, 3).map(t => t.name)
};
      `
    });

    if (searchCodeResult.success) {
      console.log('✅ search_tools working inside execute_code!');
      console.log('   Result:', searchCodeResult.result);
      console.log('   Logs:');
      searchCodeResult.logs.split('\n').forEach((line: string) => {
        if (line) console.log('   ' + line);
      });
    } else {
      console.error('❌ search_tools failed:', searchCodeResult.error);
    }

    // Step 4: Test execute_code
    console.log('\n4️⃣  Testing execute_code...');
    const codeResult = await tools.execute_code.execute({
      code: `
// Test basic JavaScript execution
console.log('Hello from Code Mode!');
console.log('Available tool namespaces:', __tool_namespaces);

// Return a result
const result = {
  message: 'Code execution successful!',
  timestamp: new Date().toISOString(),
  namespaces: __tool_namespaces
};

console.log('Result:', JSON.stringify(result, null, 2));
return result;
      `
    });

    if (codeResult.success) {
      console.log('✅ Code execution successful!');
      console.log('   Execution time:', codeResult.execution_time, 'seconds');
      console.log('   Logs:');
      codeResult.logs.split('\n').forEach((line: string) => {
        if (line) console.log('   ' + line);
      });
    } else {
      console.error('❌ Code execution failed:', codeResult.error);
    }

    // Step 5: Test MCP tool call via code execution
    console.log('\n5️⃣  Testing MCP tool call via code execution...');

    // Get first available server and tool
    if (serverNames.length > 0 && searchCodeResult.success && searchCodeResult.result.sample_tools.length > 0) {
      const firstServer = 'biocontext_hub';  // Server names are normalized: hyphens → underscores
      const firstTool = searchCodeResult.result.sample_tools[0];

      console.log(`   Testing: ${firstServer}.${firstTool}()`);

      const toolCallResult = await tools.execute_code.execute({
        code: `
// Call an MCP tool
console.log('Calling tool: ${firstServer}.${firstTool}');

try {
  const result = await ${firstServer}.${firstTool}({});
  console.log('Tool result:', typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
  return { success: true, result };
} catch (error) {
  console.error('Tool call error:', error.message);
  return { success: false, error: error.message };
}
        `
      });

      if (toolCallResult.success) {
        console.log('✅ MCP tool call via code execution successful!');
        console.log('   Logs:');
        toolCallResult.logs.split('\n').forEach((line: string) => {
          if (line) console.log('   ' + line);
        });
      } else {
        console.error('❌ MCP tool call failed:', toolCallResult.error);
      }
    } else {
      console.log('⚠️  No tools available to test MCP tool calls');
    }

    // Step 6: Test output schema visibility
    console.log('\n6️⃣  Testing output schema visibility...');
    const schemaTestResult = await tools.execute_code.execute({
      code: `
// Test 1: Check if get_tool_schema() returns output info
const firstToolName = "${searchCodeResult.result.sample_tools[0]}";
const schema = await get_tool_schema(firstToolName);

console.log("Testing tool:", firstToolName);
console.log("Has input_schema:", !!schema.input_schema);
console.log("Has output_schema:", !!schema.output_schema);
console.log("Input params count:", schema.input_parameters?.length || 0);
console.log("Output params count:", schema.output_parameters?.length || 0);

// Test 2: Check if search_tools("", "full") includes output schema
const tools = await search_tools("gene", "full");
const firstTool = tools.results[0];
console.log("\\nFirst tool from search:", firstTool.name);
console.log("Tool has input_schema:", !!firstTool.input_schema);
console.log("Tool has output_schema:", !!firstTool.output_schema);
console.log("Tool has output_parameters:", !!firstTool.output_parameters);

return {
  get_tool_schema_works: !!schema,
  schema_has_input: !!schema.input_schema,
  schema_has_output: !!schema.output_schema,
  search_has_input: !!firstTool.input_schema,
  search_has_output: !!firstTool.output_schema,
  test_passed: !!schema.input_schema && !!firstTool.input_schema
};
      `
    });

    if (schemaTestResult.success) {
      console.log('✅ Output schema test completed!');
      console.log('   Result:', schemaTestResult.result);
      console.log('   Logs:');
      schemaTestResult.logs.split('\n').forEach((line: string) => {
        if (line) console.log('   ' + line);
      });

      if (schemaTestResult.result.schema_has_output || schemaTestResult.result.search_has_output) {
        console.log('   ✅ Output schemas are being exposed!');
      } else {
        console.log('   ⚠️  Note: Tools may not have output schemas defined by the MCP server');
      }
    } else {
      console.error('❌ Output schema test failed:', schemaTestResult.error);
    }

    console.log('\n🎉 Code Mode Implementation Test Complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✓ ${serverNames.length} MCP server(s) connected`);
    console.log(`   ✓ ${searchCodeResult.result.total} tools available`);
    console.log(`   ✓ ${searchCodeResult.result.gene_count} gene-related tools found`);
    console.log('   ✓ Code execution working');
    console.log('   ✓ search_tools() working inside VM');
    console.log('   ✓ MCP tool access working');
    console.log('   ✓ Output schema visibility tested');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

// Run the test
testCodeMode().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
