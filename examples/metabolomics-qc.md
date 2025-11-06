# Metabolomics QC Analysis Example

This example demonstrates how NulaLabs analyzes metabolomics data quality using the EDA-MCP server.

## User Query

```
"Analyze the quality of my metabolomics data and show me the CV distribution"
```

## What Happens

### 1. Server Connection
```
[MCP] Connecting to EDA-MCP server...
[MCP] ✓ Connected to eda-mcp (20 tools available)
```

### 2. Data Loading
The AI automatically:
- Lists available datasets in `/data` directory
- Loads the metabolomics dataset
- Identifies PooledQC samples

```typescript
// Tool call: eda-mcp__load_csv
{
  file_path: "/data/metabolomics_batch1.csv",
  dataset_id: "metabolomics_main"
}
```

### 3. QC Calculation
```typescript
// Tool call: eda-mcp__calculate_cv
{
  dataset_id: "metabolomics_main",
  sample_type: "PooledQC",
  method: "Extraction Method A"
}
```

**Result:**
- Total metabolites: 245
- Average CV: 12.3%
- CV < 15%: 198 metabolites (80.8%)
- CV > 30%: 12 metabolites (4.9%)

### 4. Visualization Generation
The AI creates an interactive bar chart:

```jsx
<BarChart data={cvDistribution}>
  <XAxis dataKey="cvRange" />
  <YAxis label="Number of Metabolites" />
  <Bar dataKey="count" fill="#6D33A6" />
  <Tooltip />
</BarChart>
```

### 5. Workflow Node Creation
```
Session Init → Data Loading → QC Assessment
     ↓              ↓               ↓
  Projects      245 metabolites   CV: 12.3%
  Available     Loaded            Good quality
```

### 6. AI Response

> "I've analyzed the quality of your metabolomics data. Here are the key findings:
>
> **Overall Quality: Good ✅**
> - Average CV in PooledQC samples: 12.3%
> - 80.8% of metabolites have CV < 15% (excellent reproducibility)
> - Only 4.9% have CV > 30% (may need investigation)
>
> The CV distribution shows most metabolites are well-measured with good technical reproducibility. Would you like me to:
> - Identify which specific metabolites have high CV?
> - Check for batch effects across acquisition sequences?
> - Perform outlier detection in the PooledQC samples?"

### 7. Follow-up Suggestions
- ❓ "Show me which metabolites have CV > 30%"
- ❓ "Check for batch effects"
- ❓ "Detect outliers in PooledQC samples"

## Session Context Tracking

After this analysis, the session context includes:

**Loaded Datasets:**
- metabolomics_main (245 metabolites, 87 samples)

**Available Information:**
- CV analysis results by extraction method
- PooledQC sample quality metrics
- Metabolite reproducibility assessment

**Tool Calls:**
- `eda-mcp__load_csv` (1)
- `eda-mcp__calculate_cv` (1)

## Export Options

Users can:
1. **Download the CV chart** as HTML (interactive) or PNG (static)
2. **Export the workflow** showing the analysis journey
3. **Share the complete analysis** with collaborators

## Next Steps

Common follow-up analyses:
- Outlier detection → `eda-mcp__detect_outliers`
- Batch effect analysis → `eda-mcp__check_batch_effects`
- Statistical comparison → `eda-mcp__compare_groups`
- Pathway enrichment → External tools via MCP

## Technical Details

**MCP Server:** eda-mcp (local STDIO)
**Tools Used:** 2
**Execution Time:** ~3 seconds
**Tokens Used:** ~2,500
**Visualizations:** 1 (interactive bar chart)

---

[← Back to README](../README.md)
