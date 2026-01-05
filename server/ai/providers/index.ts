/**
 * AI Providers module.
 *
 * Manages AI model creation, capabilities detection, and model listing
 * across different providers (OpenAI, Ollama, LM Studio, Perplexity, etc.).
 */

// Types
export type {
  ModelConfig,
  GenerationSettings,
  ModelCapabilities,
  AvailableModel,
  AIProvider,
} from "./types";

// Factory - create model instances
export { getModels, createModelsFromConfig, getGenerationSettings } from "./factory";

// Capabilities - query what models can do
export { getModelCapabilities } from "./capabilities";

// Listing - discover available models
export {
  listModels,
  listOllamaModels,
  listOpenAICompatibleModels,
  listTranscriptionModels,
  listOpenAITranscriptionModels,
  listOpenAICompatibleTranscriptionModels,
} from "./listing";
