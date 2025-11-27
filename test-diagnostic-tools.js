// Diagnostic script to investigate tool availability
// Run this through execute_code in your chat interface

console.log("=== DIAGNOSTIC INVESTIGATION ===\n");

// 1. Use __debug_tools to see what's available
console.log("1. Checking __debug_tools()...");
const debug = __debug_tools();
console.log(`Total tools in VM: ${debug.total_count}`);
console.log(`Sessions: ${debug.sessions.join(", ")}\n`);

// 2. Find all genomoncology tools
console.log("2. Filtering genomoncology tools from available_in_vm...");
const genomoncologyAvailable = debug.available_in_vm.filter(name =>
  name.toLowerCase().includes("genomoncology")
);
console.log(`Found ${genomoncologyAvailable.length} genomoncology tools in VM:`);
genomoncologyAvailable.forEach(name => console.log(`  - ${name}`));
console.log();

// 3. Use search_tools to find genomoncology tools
console.log("3. Using search_tools to find genomoncology tools...");
const searchResults = await search_tools("genomoncology", "full");
console.log(`search_tools found ${searchResults.meta.result_count} tools`);
console.log(`Filtered count: ${searchResults.meta.filtered_count || 0}`);
console.log("Tools from search:");
searchResults.results.forEach(r => console.log(`  - ${r.name}`));
console.log();

// 4. Check specifically for gene_location
console.log("4. Looking for 'gene_location' or 'location' tools...");
const locationTools = debug.available_in_vm.filter(name =>
  name.toLowerCase().includes("genomoncology") &&
  name.toLowerCase().includes("location")
);
console.log(`Tools with 'location': ${locationTools.length}`);
locationTools.forEach(name => console.log(`  - ${name}`));
console.log();

// 5. Check for tools with 'gene' in name
console.log("5. All genomoncology tools with 'gene' in name...");
const geneTools = genomoncologyAvailable.filter(name =>
  name.toLowerCase().includes("gene")
);
console.log(`Found ${geneTools.length} gene-related tools:`);
geneTools.forEach(name => console.log(`  - ${name}`));
console.log();

// 6. Get detailed schema for gene_getter to compare
console.log("6. Getting schema for gene_getter...");
const getterSchema = get_tool_schema("genomoncology_biomcp_gene_getter");
if (getterSchema) {
  console.log("gene_getter description:", getterSchema.description);
  console.log("\nOutput parameters:");
  console.log(JSON.stringify(getterSchema.output_parameters, null, 2));
}

console.log("\n=== END DIAGNOSTIC ===");
