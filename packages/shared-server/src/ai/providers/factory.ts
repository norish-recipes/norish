/**
 * AI Provider Factory - Creates AI model instances from configuration.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOllama } from "ai-sdk-ollama";

import { getAIConfig } from "@norish/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { AIProvider, GenerationSettings, ModelConfig } from "./types";
import { createFetchWithTimeout } from "./ai-fetcher";

/**
 * Get configured AI models.
 * Throws if AI is not enabled.
 */
export async function getModels(): Promise<ModelConfig> {
  const config = await getAIConfig(true);

  if (!config || !config.enabled) {
    throw new Error("AI is not enabled. Configure AI settings in the admin panel.");
  }

  return createModelsFromConfig(config);
}

/**
 * Create AI model instances from configuration.
 * Does not check if AI is enabled - use getModels() for guarded access.
 */
export function createModelsFromConfig(config: {
  provider: AIProvider;
  model: string;
  visionModel?: string;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}): ModelConfig {
  const { provider, model, visionModel, endpoint, apiKey, timeoutMs } = config;

  aiLogger.debug({ provider, model, visionModel }, "Creating AI models");

  // Create a custom fetch that maintains a singleton Undici Agent cache
  const customFetch = createFetchWithTimeout(timeoutMs as number);

  switch (provider) {
    case "openai": {
      if (!apiKey) throw new Error("API Key is required for OpenAI provider");

      const openai = createOpenAI({ apiKey, fetch: customFetch });

      return {
        model: openai(model),
        visionModel: openai(visionModel || model),
        providerName: "OpenAI",
      };
    }

    case "ollama": {
      if (!endpoint) throw new Error("Endpoint is required for Ollama provider");

      // ai-sdk-ollama uses the Ollama host directly (e.g. http://localhost:11434)
      const ollamaBaseUrl = endpoint.replace(/\/+$/, "").replace(/\/api$/, "");
      const ollama = createOllama({ baseURL: ollamaBaseUrl, fetch: customFetch });

      return {
        model: ollama(model, { structuredOutputs: true }),
        visionModel: ollama(visionModel || model, { structuredOutputs: true }),
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
        fetch: customFetch,
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
      const perplexity = createPerplexity({ apiKey, fetch: customFetch });

      return {
        model: perplexity(model),
        visionModel: perplexity(visionModel || model),
        providerName: "Perplexity",
      };
    }

    case "azure": {
      if (!apiKey) throw new Error("API Key is required for Azure OpenAI provider");

      let azure;

      if (endpoint) {
        let baseUrl = endpoint.replace(/\/+$/, "");

        // Ensure /openai path is included for SDK compatibility
        if (!baseUrl.endsWith("/openai")) {
          baseUrl = `${baseUrl}/openai`;
        }

        azure = createAzure({ apiKey, baseURL: baseUrl, fetch: customFetch });
      } else {
        azure = createAzure({ apiKey, fetch: customFetch });
      }

      return {
        model: azure(model),
        visionModel: azure(visionModel || model),
        providerName: "Azure OpenAI",
      };
    }

    case "mistral": {
      if (!apiKey) throw new Error("API Key is required for Mistral provider");

      const mistral = createMistral({ apiKey, fetch: customFetch });

      return {
        model: mistral(model),
        visionModel: mistral(visionModel || model),
        providerName: "Mistral",
      };
    }

    case "anthropic": {
      if (!apiKey) throw new Error("API Key is required for Anthropic provider");

      const anthropic = createAnthropic({ apiKey, fetch: customFetch });

      return {
        model: anthropic(model),
        visionModel: anthropic(visionModel || model),
        providerName: "Anthropic",
      };
    }

    case "deepseek": {
      if (!apiKey) throw new Error("API Key is required for DeepSeek provider");

      const deepseek = createDeepSeek({ apiKey, fetch: customFetch });

      return {
        model: deepseek(model),
        visionModel: deepseek(visionModel || model),
        providerName: "DeepSeek",
      };
    }

    case "google": {
      if (!apiKey) throw new Error("API Key is required for Google AI provider");

      const google = createGoogleGenerativeAI({ apiKey, fetch: customFetch });

      return {
        model: google(model),
        visionModel: google(visionModel || model),
        providerName: "Google AI",
      };
    }

    case "groq": {
      if (!apiKey) throw new Error("API Key is required for Groq provider");

      const groq = createGroq({ apiKey, fetch: customFetch });

      return {
        model: groq(model),
        visionModel: groq(visionModel || model),
        providerName: "Groq",
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
    abortSignal: AbortSignal.timeout(config?.timeoutMs as number),
  };
}
