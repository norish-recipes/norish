/**
 * AI Provider Listing - List available models from providers.
 */

import type { AvailableModel, AIProvider } from "./types";

import { aiLogger } from "@/server/logger";

// ============================================================================
// Generic Fetch Helper
// ============================================================================

interface FetchModelsOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
  /** Path to models array in response (e.g., "data" or "models") */
  dataPath?: "data" | "models";
  /** Provider name for logging */
  provider: string;
}

interface RawModel {
  id: string;
  name?: string;
  display_name?: string;
  displayName?: string;
  owned_by?: string;
  active?: boolean;
  capabilities?: {
    completion_chat?: boolean;
    vision?: boolean;
  };
  supportedGenerationMethods?: string[];
}

/**
 * Generic fetch helper for model listing APIs.
 * Handles common error handling, timeout, and logging.
 */
async function fetchModelsRaw(options: FetchModelsOptions): Promise<RawModel[]> {
  const { url, headers = {}, timeout = 10000, dataPath = "data", provider } = options;

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      aiLogger.debug({ status: response.status, provider }, `${provider} models request failed`);

      return [];
    }

    const data = await response.json();

    return data[dataPath] || [];
  } catch (error) {
    aiLogger.debug({ err: error, provider }, `Failed to list ${provider} models`);

    return [];
  }
}

// ============================================================================
// Provider-Specific Model Transformers
// ============================================================================

type ModelFilter = (m: RawModel) => boolean;
type ModelMapper = (m: RawModel) => AvailableModel;

// ============================================================================
// Provider Configurations
// ============================================================================

interface ProviderConfig {
  url: string | ((apiKey: string) => string);
  headers: (apiKey: string) => Record<string, string>;
  dataPath?: "data" | "models";
  filter?: ModelFilter;
  mapper: ModelMapper;
}

const providerConfigs: Record<string, ProviderConfig> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    filter: (m) => {
      const id = m.id.toLowerCase();

      return (
        !id.includes("embedding") &&
        !id.includes("whisper") &&
        !id.includes("tts") &&
        !id.includes("dall-e") &&
        !id.includes("davinci") &&
        !id.includes("babbage") &&
        !id.includes("curie") &&
        !id.includes("ada") &&
        !id.startsWith("ft:")
      );
    },
    mapper: (m) => ({
      id: m.id,
      name: m.id,
      supportsVision: m.id.includes("gpt-4") || m.id.includes("gpt-5") || m.id.includes("o1"),
    }),
  },

  mistral: {
    url: "https://api.mistral.ai/v1/models",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    filter: (m) => m.capabilities?.completion_chat !== false && !m.id.startsWith("ft:"),
    mapper: (m) => ({
      id: m.id,
      name: m.id,
      supportsVision: m.capabilities?.vision === true || m.id.toLowerCase().includes("pixtral"),
    }),
  },

  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (apiKey) => ({ "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
    mapper: (m) => ({
      id: m.id,
      name: m.display_name || m.id,
      supportsVision: true, // All current Anthropic models support vision
    }),
  },

  groq: {
    url: "https://api.groq.com/openai/v1/models",
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    filter: (m) => {
      const id = m.id.toLowerCase();

      return m.active !== false && !id.includes("whisper");
    },
    mapper: (m) => ({
      id: m.id,
      name: m.id,
      supportsVision: m.id.toLowerCase().includes("vision"),
    }),
  },

  google: {
    url: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    headers: () => ({}),
    dataPath: "models",
    filter: (m) => m.supportedGenerationMethods?.includes("generateContent") ?? false,
    mapper: (m) => {
      // name format is "models/gemini-1.5-flash" - extract just the model ID
      const id = (m.name || m.id).replace("models/", "");

      return {
        id,
        name: m.displayName || id,
        supportsVision: true, // All Gemini models support vision
      };
    },
  },
};

/**
 * List models using provider config.
 */
async function listModelsWithConfig(provider: string, apiKey: string): Promise<AvailableModel[]> {
  const config = providerConfigs[provider];

  if (!config) return [];

  const url = typeof config.url === "function" ? config.url(apiKey) : config.url;
  const models = await fetchModelsRaw({
    url,
    headers: config.headers(apiKey),
    dataPath: config.dataPath,
    provider,
  });

  let result = models;

  if (config.filter) {
    result = result.filter(config.filter);
  }

  const mapped = result.map(config.mapper).sort((a, b) => a.id.localeCompare(b.id));

  aiLogger.debug({ count: mapped.length, provider }, `${provider} models listed`);

  return mapped;
}

// ============================================================================
// Ollama (different API structure)
// ============================================================================

/**
 * List available models from Ollama.
 */
export async function listOllamaModels(endpoint: string): Promise<AvailableModel[]> {
  try {
    const baseUrl = endpoint.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const models: Array<{ name: string }> = data.models || [];

    return models.map((m) => ({
      id: m.name,
      name: m.name,
      supportsVision:
        m.name.toLowerCase().includes("llava") ||
        m.name.toLowerCase().includes("vision") ||
        m.name.toLowerCase().includes("bakllava"),
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// OpenAI-Compatible (endpoint-based)
// ============================================================================

/**
 * List available models from an OpenAI-compatible endpoint (LM Studio, etc.).
 */
export async function listOpenAICompatibleModels(
  endpoint: string,
  apiKey?: string
): Promise<AvailableModel[]> {
  let baseUrl = endpoint.replace(/\/+$/, "");

  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }

  const headers: Record<string, string> = {};

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const models = await fetchModelsRaw({
    url: `${baseUrl}/v1/models`,
    headers,
    timeout: 5000,
    provider: "OpenAI-compatible",
  });

  return models.map((m) => ({
    id: m.id,
    name: m.id,
    supportsVision: m.id.toLowerCase().includes("vision") || m.id.toLowerCase().includes("llava"),
  }));
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * List available models for any supported provider.
 * Returns an empty array if listing fails or is not supported.
 */
export async function listModels(
  provider: AIProvider,
  options: { endpoint?: string; apiKey?: string }
): Promise<AvailableModel[]> {
  const { endpoint, apiKey } = options;

  // Providers with standard config-based listing
  if (providerConfigs[provider]) {
    if (!apiKey) {
      aiLogger.debug({ provider }, `Cannot list ${provider} models without API key`);

      return [];
    }

    return listModelsWithConfig(provider, apiKey);
  }

  // Special cases
  switch (provider) {
    case "ollama":
      if (!endpoint) {
        aiLogger.debug("Cannot list Ollama models without endpoint");

        return [];
      }

      return listOllamaModels(endpoint);

    case "lm-studio":
    case "generic-openai":
      if (!endpoint) {
        aiLogger.debug("Cannot list models without endpoint");

        return [];
      }

      return listOpenAICompatibleModels(endpoint, apiKey);

    case "perplexity":
      // Perplexity doesn't have a models list endpoint
      return [
        { id: "sonar", name: "Sonar", supportsVision: false },
        { id: "sonar-pro", name: "Sonar Pro", supportsVision: false },
        { id: "sonar-reasoning", name: "Sonar Reasoning", supportsVision: false },
        { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", supportsVision: false },
        { id: "sonar-deep-research", name: "Sonar Deep Research", supportsVision: false },
      ];

    case "azure":
      // Azure uses deployment names - manual entry required
      aiLogger.debug("Azure OpenAI uses deployment names - manual entry required");

      return [];

    case "deepseek":
      // DeepSeek doesn't have a public models list endpoint
      return [
        { id: "deepseek-chat", name: "DeepSeek Chat", supportsVision: false },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner", supportsVision: false },
      ];

    default:
      aiLogger.debug({ provider }, "Unknown provider for model listing");

      return [];
  }
}

// ============================================================================
// Transcription Models
// ============================================================================

/**
 * List available transcription (Whisper) models from OpenAI.
 */
export async function listOpenAITranscriptionModels(apiKey: string): Promise<AvailableModel[]> {
  const models = await fetchModelsRaw({
    url: "https://api.openai.com/v1/models",
    headers: { Authorization: `Bearer ${apiKey}` },
    provider: "OpenAI",
  });

  return models
    .filter((m) => m.id.toLowerCase().includes("whisper"))
    .map((m) => ({ id: m.id, name: m.id, supportsVision: false }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * List available transcription models from an OpenAI-compatible endpoint.
 */
export async function listOpenAICompatibleTranscriptionModels(
  endpoint: string,
  apiKey?: string
): Promise<AvailableModel[]> {
  let baseUrl = endpoint.replace(/\/+$/, "");

  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }

  const headers: Record<string, string> = {};

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const models = await fetchModelsRaw({
    url: `${baseUrl}/v1/models`,
    headers,
    timeout: 5000,
    provider: "OpenAI-compatible",
  });

  // Prefer whisper models, but return all if none found
  const whisperModels = models.filter((m) => m.id.toLowerCase().includes("whisper"));
  const modelsToReturn = whisperModels.length > 0 ? whisperModels : models;

  return modelsToReturn.map((m) => ({ id: m.id, name: m.id, supportsVision: false }));
}

/**
 * List available transcription models for a given provider.
 */
export async function listTranscriptionModels(
  provider: "openai" | "generic-openai" | "disabled",
  options: { endpoint?: string; apiKey?: string }
): Promise<AvailableModel[]> {
  const { endpoint, apiKey } = options;

  switch (provider) {
    case "openai":
      if (!apiKey) {
        aiLogger.debug("Cannot list OpenAI transcription models without API key");

        return [];
      }

      return listOpenAITranscriptionModels(apiKey);

    case "generic-openai":
      if (!endpoint) {
        aiLogger.debug("Cannot list transcription models without endpoint");

        return [];
      }

      return listOpenAICompatibleTranscriptionModels(endpoint, apiKey);

    case "disabled":
    default:
      return [];
  }
}
