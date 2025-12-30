import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOllama } from "ollama-ai-provider-v2";
import type { LanguageModel } from "ai";

import { getAIConfig } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";
import type { AIConfig } from "@/server/db/zodSchemas/server-config";

export interface ModelConfig {
  /** Primary text model */
  model: LanguageModel;
  /** Vision-capable model for image processing */
  visionModel: LanguageModel;
  /** Provider name for logging */
  providerName: string;
}

export interface GenerationSettings {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ModelCapabilities {
  supportsTemperature: boolean;
  supportsMaxTokens: boolean;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  maxTemperature: number;
}

export async function getModels(): Promise<ModelConfig> {
  const config = await getAIConfig(true);

  if (!config || !config.enabled) {
    throw new Error("AI is not enabled. Configure AI settings in the admin panel.");
  }

  return createModelsFromConfig(config);
}

export function createModelsFromConfig(config: {
  provider: AIConfig["provider"];
  model: string;
  visionModel?: string;
  endpoint?: string;
  apiKey?: string;
}): ModelConfig {
  const { provider, model, visionModel, endpoint, apiKey } = config;

  aiLogger.debug({ provider, model, visionModel }, "Creating AI models");

  switch (provider) {
    case "openai": {
      if (!apiKey) throw new Error("API Key is required for OpenAI provider");

      const openai = createOpenAI({ apiKey });
      return {
        model: openai(model),
        visionModel: openai(visionModel || model),
        providerName: "OpenAI",
      };
    }

    case "ollama": {
      if (!endpoint) throw new Error("Endpoint is required for Ollama provider");

      const ollama = createOllama({ baseURL: endpoint });
      return {
        model: ollama(model),
        visionModel: ollama(visionModel || model),
        providerName: "Ollama",
      };
    }

    case "lm-studio":
    case "generic-openai": {
      if (!endpoint) throw new Error("Endpoint is required for this provider");

      let normalizedEndpoint = endpoint.replace(/\/+$/, ""); // Remove trailing slashes
      if (!normalizedEndpoint.endsWith("/v1")) {
        normalizedEndpoint = `${normalizedEndpoint}/v1`;
      }

      const providerName = provider === "lm-studio" ? "lmstudio" : "generic-openai";
      const compatible = createOpenAICompatible({
        name: providerName,
        baseURL: normalizedEndpoint,
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        supportsStructuredOutputs: true,
      });

      return {
        model: compatible(model),
        visionModel: compatible(visionModel || model),
        providerName: provider === "lm-studio" ? "LM Studio" : "Generic OpenAI",
      };
    }

    case "perplexity": {
      if (!apiKey) throw new Error("API Key is required for Perplexity provider");

      // Use the official Perplexity AI SDK provider
      const perplexity = createPerplexity({ apiKey });
      return {
        model: perplexity(model),
        visionModel: perplexity(visionModel || model),
        providerName: "Perplexity",
      };
    }

    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Get generation settings from config (temperature, maxTokens).
 * These are passed to generateText() calls.
 */
export async function getGenerationSettings(): Promise<GenerationSettings> {
  const config = await getAIConfig(true);

  return {
    temperature: config?.temperature,
    maxOutputTokens: config?.maxTokens,
  };
}

/**
 * Query model capabilities dynamically.
 *
 * For Ollama, queries the /api/show endpoint.
 * For OpenAI, uses known capabilities.
 * For others, uses sensible defaults.
 */
export async function getModelCapabilities(
  provider: AIConfig["provider"],
  endpoint?: string,
  model?: string
): Promise<ModelCapabilities> {
  const defaults: ModelCapabilities = {
    supportsTemperature: true,
    supportsMaxTokens: true,
    supportsVision: false,
    supportsStructuredOutput: true,
    maxTemperature: 2,
  };

  try {
    switch (provider) {
      case "openai":
        return {
          ...defaults,
          supportsVision: true, // Most GPT-4+ models support vision
          supportsStructuredOutput: true,
        };

      case "ollama":
        if (endpoint && model) {
          return await queryOllamaCapabilities(endpoint, model, defaults);
        }
        return {
          ...defaults,
          supportsMaxTokens: false, // Ollama uses num_predict
          supportsVision: false, // Depends on model
        };

      case "lm-studio":
        return {
          ...defaults,
          supportsVision: false, // Depends on loaded model
          supportsStructuredOutput: true,
        };

      case "generic-openai":
        return {
          ...defaults,
          supportsVision: false, // Unknown
          supportsStructuredOutput: false, // May not support json_schema
        };

      default:
        return defaults;
    }
  } catch (error) {
    aiLogger.warn({ err: error, provider }, "Failed to query model capabilities, using defaults");
    return defaults;
  }
}

/**
 * Query Ollama for model capabilities.
 */
async function queryOllamaCapabilities(
  endpoint: string,
  model: string,
  defaults: ModelCapabilities
): Promise<ModelCapabilities> {
  try {
    // Normalize endpoint (remove trailing slash)
    const baseUrl = endpoint.replace(/\/+$/, "");

    const response = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      aiLogger.debug({ status: response.status }, "Ollama /api/show request failed");
      return { ...defaults, supportsMaxTokens: false };
    }

    const data = await response.json();

    // Check model info for vision capability
    const modelInfo = data.details || {};
    const families = modelInfo.families || [];
    const hasVision =
      families.includes("clip") ||
      model.toLowerCase().includes("llava") ||
      model.toLowerCase().includes("vision");

    aiLogger.debug({ model, families, hasVision }, "Ollama model capabilities detected");

    return {
      supportsTemperature: true,
      supportsMaxTokens: false, // Ollama uses num_predict, not max_tokens
      supportsVision: hasVision,
      supportsStructuredOutput: true, // Ollama supports JSON mode
      maxTemperature: 2,
    };
  } catch (error) {
    aiLogger.debug({ err: error }, "Failed to query Ollama capabilities");
    return { ...defaults, supportsMaxTokens: false };
  }
}

/**
 * List available models from Ollama.
 */
export async function listOllamaModels(endpoint: string): Promise<string[]> {
  try {
    const baseUrl = endpoint.replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  } catch {
    return [];
  }
}

/**
 * Model info returned by listing functions.
 */
export interface AvailableModel {
  id: string;
  name: string;
  supportsVision?: boolean;
}

/**
 * List available models from OpenAI.
 * Filters to only include chat models suitable for our use case.
 */
export async function listOpenAIModels(apiKey: string): Promise<AvailableModel[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      aiLogger.debug({ status: response.status }, "OpenAI /v1/models request failed");
      return [];
    }

    const data = await response.json();
    const models: Array<{ id: string; owned_by: string }> = data.data || [];

    // Filter to chat/completion models and sort by name
    // Exclude embedding, whisper, tts, dall-e models
    const chatModels = models
      .filter((m) => {
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
          !id.startsWith("ft:") // Exclude fine-tuned models from list (user can still type them)
        );
      })
      .map((m) => ({
        id: m.id,
        name: m.id,
        supportsVision: m.id.includes("vision") || m.id.includes("gpt-4") || m.id.includes("gpt-5"),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    aiLogger.debug({ count: chatModels.length }, "OpenAI models listed");
    return chatModels;
  } catch (error) {
    aiLogger.debug({ err: error }, "Failed to list OpenAI models");
    return [];
  }
}

/**
 * List available models from an OpenAI-compatible endpoint (LM Studio, etc.).
 * These endpoints expose /v1/models like OpenAI.
 */
export async function listOpenAICompatibleModels(
  endpoint: string,
  apiKey?: string
): Promise<AvailableModel[]> {
  try {
    // Normalize endpoint: remove trailing slashes and /v1 suffix if present
    // We'll add /v1/models ourselves
    let baseUrl = endpoint.replace(/\/+$/, "");
    if (baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.slice(0, -3);
    }

    const headers: Record<string, string> = {};

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      aiLogger.debug(
        { status: response.status, endpoint },
        "OpenAI-compatible /v1/models request failed"
      );
      return [];
    }

    const data = await response.json();
    const models: Array<{ id: string; owned_by?: string }> = data.data || [];

    const result = models.map((m) => ({
      id: m.id,
      name: m.id,
      supportsVision: m.id.toLowerCase().includes("vision") || m.id.toLowerCase().includes("llava"),
    }));

    aiLogger.debug({ count: result.length, endpoint }, "OpenAI-compatible models listed");
    return result;
  } catch (error) {
    aiLogger.debug({ err: error, endpoint }, "Failed to list OpenAI-compatible models");
    return [];
  }
}

/**
 * List available models for any supported provider.
 * Returns an empty array if listing fails or is not supported.
 */
export async function listModels(
  provider: AIConfig["provider"],
  options: { endpoint?: string; apiKey?: string }
): Promise<AvailableModel[]> {
  const { endpoint, apiKey } = options;

  switch (provider) {
    case "openai":
      if (!apiKey) {
        aiLogger.debug("Cannot list OpenAI models without API key");
        return [];
      }
      return listOpenAIModels(apiKey);

    case "ollama":
      if (!endpoint) {
        aiLogger.debug("Cannot list Ollama models without endpoint");
        return [];
      }
      // Convert string[] to AvailableModel[]
      const ollamaModels = await listOllamaModels(endpoint);
      return ollamaModels.map((id) => ({
        id,
        name: id,
        supportsVision:
          id.toLowerCase().includes("llava") ||
          id.toLowerCase().includes("vision") ||
          id.toLowerCase().includes("bakllava"),
      }));

    case "lm-studio":
    case "generic-openai":
      if (!endpoint) {
        aiLogger.debug("Cannot list models without endpoint");
        return [];
      }
      return listOpenAICompatibleModels(endpoint, apiKey);

    case "perplexity":
      // Perplexity doesn't have a models list endpoint, return known models
      // See: https://docs.perplexity.ai
      return [
        { id: "sonar", name: "Sonar", supportsVision: false },
        { id: "sonar-pro", name: "Sonar Pro", supportsVision: false },
        { id: "sonar-reasoning", name: "Sonar Reasoning", supportsVision: false },
        { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", supportsVision: false },
        { id: "sonar-deep-research", name: "Sonar Deep Research", supportsVision: false },
      ];

    default:
      aiLogger.debug({ provider }, "Unknown provider for model listing");
      return [];
  }
}

/**
 * List available transcription (Whisper) models from OpenAI.
 * Filters to only include whisper models.
 */
export async function listOpenAITranscriptionModels(apiKey: string): Promise<AvailableModel[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      aiLogger.debug({ status: response.status }, "OpenAI /v1/models request failed");
      return [];
    }

    const data = await response.json();
    const models: Array<{ id: string; owned_by: string }> = data.data || [];

    // Filter to whisper/transcription models only
    const whisperModels = models
      .filter((m) => m.id.toLowerCase().includes("whisper"))
      .map((m) => ({
        id: m.id,
        name: m.id,
        supportsVision: false,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    aiLogger.debug({ count: whisperModels.length }, "OpenAI transcription models listed");
    return whisperModels;
  } catch (error) {
    aiLogger.debug({ err: error }, "Failed to list OpenAI transcription models");
    return [];
  }
}

/**
 * List available transcription models from an OpenAI-compatible endpoint.
 * Filters to whisper/transcription models if possible.
 */
export async function listOpenAICompatibleTranscriptionModels(
  endpoint: string,
  apiKey?: string
): Promise<AvailableModel[]> {
  try {
    // Normalize endpoint
    let baseUrl = endpoint.replace(/\/+$/, "");
    if (baseUrl.endsWith("/v1")) {
      baseUrl = baseUrl.slice(0, -3);
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      aiLogger.debug(
        { status: response.status, endpoint },
        "OpenAI-compatible /v1/models request failed for transcription"
      );
      return [];
    }

    const data = await response.json();
    const models: Array<{ id: string; owned_by?: string }> = data.data || [];

    // Try to filter to whisper models, but if none found return all (user can pick)
    const whisperModels = models.filter((m) => m.id.toLowerCase().includes("whisper"));
    const modelsToReturn = whisperModels.length > 0 ? whisperModels : models;

    const result = modelsToReturn.map((m) => ({
      id: m.id,
      name: m.id,
      supportsVision: false,
    }));

    aiLogger.debug(
      { count: result.length, endpoint },
      "OpenAI-compatible transcription models listed"
    );
    return result;
  } catch (error) {
    aiLogger.debug(
      { err: error, endpoint },
      "Failed to list OpenAI-compatible transcription models"
    );
    return [];
  }
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
