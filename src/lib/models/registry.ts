/**
 * Model registry containing metadata and configuration for all available models
 */

import type { ModelConfig } from './types';

// Re-export ModelConfig for external use
export type { ModelConfig };

/**
 * Registry of all available models
 * Add new models here to make them available in the UI
 */
export const MODEL_REGISTRY: ModelConfig[] = [
  // Anthropic Claude Models
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Advanced reasoning for complex metabolomics analysis and multi-step workflows',
    capabilities: {
      streaming: true,
      toolCalling: true,
      visionSupport: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    icon: '🧠',
    costPer1kTokens: { input: 3, output: 15 },
    status: 'available',
    tags: ['general', 'reasoning', 'default'],
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude Haiku 3.5',
    provider: 'anthropic',
    description: 'Fast and cost-effective for simple queries and quick data lookups',
    capabilities: {
      streaming: true,
      toolCalling: true,
      visionSupport: false,
      maxTokens: 8192,
      contextWindow: 200000,
    },
    icon: '⚡',
    costPer1kTokens: { input: 0.25, output: 1.25 },
    status: 'available',
    tags: ['fast', 'cheap', 'general'],
  },

  // Biomni Specialized Models
  {
    id: 'biomni-r0',
    name: 'Biomni-R0',
    provider: 'biomni',
    description: 'Specialized biology reasoning model for genomics, metabolomics, and experimental design',
    capabilities: {
      streaming: true,
      toolCalling: true,
      visionSupport: false,
      maxTokens: 8192,
      contextWindow: 131072,
    },
    endpoint: process.env.BIOMNI_URL || 'http://localhost:30000/v1',
    apiKeyEnv: 'BIOMNI_API_KEY',
    icon: '🧬',
    status: 'experimental',
    tags: ['biology', 'specialist', 'genomics', 'metabolomics'],
  },

  // OpenAI Models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal reasoning with vision support for analyzing images and charts',
    capabilities: {
      streaming: true,
      toolCalling: true,
      visionSupport: true,
      maxTokens: 16384,
      contextWindow: 128000,
    },
    icon: '🤖',
    costPer1kTokens: { input: 2.5, output: 10 },
    status: 'available',
    tags: ['multimodal', 'vision', 'general'],
  },
];

/**
 * Get a model configuration by its ID
 * @param id - Model identifier
 * @returns Model configuration or undefined if not found
 */
export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}

/**
 * Get all available models (excluding unavailable ones)
 * @returns Array of available model configurations
 */
export function getAvailableModels(): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.status === 'available' || m.status === 'experimental');
}

/**
 * Get models by tag
 * @param tag - Tag to filter by
 * @returns Array of models matching the tag
 */
export function getModelsByTag(tag: string): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.tags?.includes(tag));
}

/**
 * Get models by provider
 * @param provider - Provider to filter by
 * @returns Array of models from the specified provider
 */
export function getModelsByProvider(provider: string): ModelConfig[] {
  return MODEL_REGISTRY.filter(m => m.provider === provider);
}

/**
 * Get the default model (used when no model is specified)
 * @returns Default model configuration
 */
export function getDefaultModel(): ModelConfig {
  return getModelById('claude-3-5-haiku-20241022') || MODEL_REGISTRY[0];
}
