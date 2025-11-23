/**
 * Model configuration and capabilities types for multi-model support
 */

/**
 * Model capability flags indicating what features a model supports
 */
export interface ModelCapabilities {
  /** Whether the model supports streaming responses */
  streaming: boolean;
  /** Whether the model supports function/tool calling */
  toolCalling: boolean;
  /** Whether the model supports vision/image inputs */
  visionSupport: boolean;
  /** Maximum output tokens per request */
  maxTokens: number;
  /** Total context window size in tokens */
  contextWindow: number;
}

/**
 * Pricing information for a model
 */
export interface ModelPricing {
  /** Cost per 1000 input tokens in USD */
  input: number;
  /** Cost per 1000 output tokens in USD */
  output: number;
}

/**
 * Supported model providers
 */
export type ModelProvider =
  | 'anthropic'   // Anthropic Claude models
  | 'openai'      // OpenAI GPT models
  | 'biomni'      // Biomni-R0 specialized models
  | 'custom';     // Custom OpenAI-compatible endpoints

/**
 * Model availability status
 */
export type ModelStatus =
  | 'available'    // Production-ready
  | 'experimental' // Beta/testing
  | 'unavailable'; // Temporarily offline

/**
 * Complete configuration for a model
 */
export interface ModelConfig {
  /** Unique identifier for the model */
  id: string;
  /** Display name shown to users */
  name: string;
  /** Provider type */
  provider: ModelProvider;
  /** Short description of model's strengths and use cases */
  description: string;
  /** Model capabilities */
  capabilities: ModelCapabilities;
  /** Optional API endpoint for custom models */
  endpoint?: string;
  /** Optional environment variable name for API key */
  apiKeyEnv?: string;
  /** Optional icon emoji for UI display */
  icon?: string;
  /** Optional pricing information */
  costPer1kTokens?: ModelPricing;
  /** Current availability status */
  status: ModelStatus;
  /** Optional tags for categorization */
  tags?: string[];
}
