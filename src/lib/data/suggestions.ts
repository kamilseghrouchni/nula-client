/**
 * Pre-defined suggestion queries for the welcome screen
 * These are example queries users can click to start conversations
 */

export const suggestions = [
  "What are the top druggable pathways in longevity research?",
  "Tell me everything you know about TP53",
  "What are the latest compounds targeting EGFR?",
] as const;

export type SuggestionQuery = typeof suggestions[number];
