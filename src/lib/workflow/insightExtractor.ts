import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

/**
 * Extract a concise insight from an analysis response using LLM
 *
 * This function makes a lightweight Haiku call to summarize the key finding
 * from a longer analysis response into a single, actionable insight.
 */
export async function extractInsightFromResponse(
  responseText: string,
  phase: string
): Promise<string | null> {
  if (!responseText || responseText.trim().length === 0) {
    return null;
  }

  // Debug: Log what we're analyzing
  console.log(`[Insight Extractor] Analyzing ${responseText.length} chars for phase: ${phase}`);
  console.log(`[Insight Extractor] First 200 chars:`, responseText.substring(0, 200));

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      prompt: `You are analyzing the output from a metabolomics data analysis step.

Analysis Phase: ${phase}

Analysis Response:
${responseText}

Extract the single most important insight about THE DATA from this analysis.

CRITICAL PRIORITY ORDER:
1. **DATA INTERPRETATIONS FIRST** - What patterns, values, trends, or findings were discovered in the data?
2. **ACTIONS ONLY IF NO DATA INSIGHTS** - What was done (only if there are no interpretable findings about the data itself)

Requirements:
- Maximum 100 characters
- Be specific and quantitative when possible
- Prioritize what the data SHOWS/REVEALS over what was DONE
- Use active voice
- No unnecessary words

Examples of GOOD insights (data-focused):
- "PC1 explains 67% variance, clear separation between treatment groups"
- "High CV in lipid metabolites: avg 18%, max 34%"
- "23 metabolites show significant differences (p<0.05, FC>2)"
- "Strong batch effect detected: 23% variance between batches"
- "Normalization reduced batch variance from 23% to 5%"

Examples of ACCEPTABLE insights (action-focused, use only if no data findings):
- "Loaded 245 metabolites across 120 samples from 3 batches"
- "Applied log transformation and quantile normalization"

Examples to AVOID (too vague):
- "Data was loaded" ❌
- "Analysis completed" ❌
- "Plot was generated" ❌

Return ONLY the insight text, nothing else.`,
    });

    const insight = text.trim();

    console.log(`[Insight Extractor] Generated insight: "${insight}"`);

    // Validate insight length
    if (insight.length > 150) {
      const truncated = insight.substring(0, 147) + '...';
      console.log(`[Insight Extractor] Truncated to: "${truncated}"`);
      return truncated;
    }

    return insight || null;
  } catch (error) {
    console.error('[Insight Extractor] Error:', error);
    return null;
  }
}

/**
 * Extract insights from multiple responses in parallel
 */
export async function extractInsightsInBatch(
  responses: Array<{ text: string; phase: string }>
): Promise<Array<string | null>> {
  return Promise.all(
    responses.map(({ text, phase }) => extractInsightFromResponse(text, phase))
  );
}
