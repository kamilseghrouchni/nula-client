/**
 * Pre-defined suggestion queries for the welcome screen
 * These are example queries users can click to start conversations
 */

export const suggestions = [
  "Analyze analytical variability and quality metrics in my LC-MS data",
  "Assess standard stability and reproducibility across runs",
  "Evaluate batch effects and systematic variation patterns",
] as const;

export type SuggestionQuery = typeof suggestions[number];
