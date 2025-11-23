/**
 * Provider factory for creating model instances from different providers
 */

import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { getModelById } from './registry';

/**
 * Create a model provider instance based on model ID
 *
 * @param modelId - The unique identifier of the model
 * @returns Configured language model instance
 * @throws Error if model not found or provider not implemented
 *
 * @example
 * ```typescript
 * const model = createModelProvider('claude-sonnet-4-5');
 * const result = await streamText({ model, messages, tools });
 * ```
 */
export function createModelProvider(modelId: string): LanguageModel {
  const config = getModelById(modelId);

  console.log('[ProviderFactory] 🏭 Creating provider for:', modelId);

  if (!config) {
    console.error('[ProviderFactory] ❌ No config found for:', modelId);
    throw new Error(`Model ${modelId} not found in registry`);
  }

  console.log('[ProviderFactory] 📋 Config:', {
    id: config.id,
    provider: config.provider,
    endpoint: config.endpoint
  });

  switch (config.provider) {
    case 'anthropic':
      // Use Anthropic's native provider
      console.log('[ProviderFactory] 🤖 Creating Anthropic provider for:', modelId);
      return anthropic(modelId);

    case 'openai':
      // Use OpenAI's native provider
      console.log('[ProviderFactory] 🤖 Creating OpenAI provider for:', modelId);
      return openai(modelId);

    case 'biomni':
      // Create OpenAI-compatible provider for Biomni-R0
      console.log('[ProviderFactory] 🧬 Creating Biomni provider for:', modelId);
      console.log('[ProviderFactory] 🔗 Biomni endpoint:', config.endpoint);
      console.log('[ProviderFactory] 🔑 Biomni API key env:', config.apiKeyEnv || 'BIOMNI_API_KEY');
      const biomniProvider = createOpenAI({
        name: 'biomni',
        baseURL: config.endpoint,
        apiKey: process.env[config.apiKeyEnv || 'BIOMNI_API_KEY'] || 'EMPTY',
      });
      console.log('[ProviderFactory] ✅ Biomni provider created, calling with modelId:', modelId);
      return biomniProvider(modelId);

    case 'custom':
      // Generic custom endpoint (OpenAI-compatible)
      console.log('[ProviderFactory] 🔧 Creating custom provider for:', modelId);
      if (!config.endpoint) {
        throw new Error(`Custom model ${modelId} requires endpoint configuration`);
      }
      const customProvider = createOpenAI({
        baseURL: config.endpoint,
        apiKey: process.env[config.apiKeyEnv || 'CUSTOM_API_KEY'] || 'EMPTY',
      });
      return customProvider(modelId);

    default:
      console.error('[ProviderFactory] ❌ Unknown provider:', config.provider);
      throw new Error(`Provider ${config.provider} not implemented`);
  }
}

/**
 * Check if a model is available (server reachable, API key configured, etc.)
 *
 * @param modelId - The unique identifier of the model
 * @returns Promise resolving to true if model is available
 */
export async function checkModelAvailability(modelId: string): Promise<boolean> {
  const config = getModelById(modelId);

  if (!config) {
    return false;
  }

  // For now, just check if the model is marked as available
  // In the future, could ping the endpoint or check API key validity
  return config.status === 'available' || config.status === 'experimental';
}
