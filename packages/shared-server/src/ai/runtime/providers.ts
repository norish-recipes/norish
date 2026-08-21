/**
 * AI provider construction — language models and transcription clients.
 *
 * Every client built here goes through the shared transport, so timeout and
 * connection handling are one behaviour rather than one per feature. The two
 * transcription providers the AI SDK cannot serve — the generic
 * OpenAI-compatible endpoint and Ollama — keep their raw clients, but those
 * escape hatches live inside this provider boundary rather than in a feature
 * file.
 */

import type { TranscriptionModel } from "ai";
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
import OpenAI from "openai";

import { aiLogger } from "@norish/shared-server/logger";

import type { AIProvider, ModelConfig } from "./types";
import { withTemperatureFallback } from "./temperature-fallback";
import { createFetchWithTimeout } from "./transport";

// ============================================================================
// Endpoint normalization — each rule exists exactly once
// ============================================================================

/** The Azure SDK expects the /openai path suffix on a configured endpoint. */
function normalizeAzureEndpoint(endpoint: string): string {
  const baseUrl = endpoint.replace(/\/+$/, "");

  return baseUrl.endsWith("/openai") ? baseUrl : `${baseUrl}/openai`;
}

/** OpenAI-compatible endpoints are addressed under /v1. */
function normalizeOpenAICompatibleEndpoint(endpoint: string): string {
  const baseUrl = endpoint.replace(/\/+$/, "");

  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

/** Ollama is addressed at its host root, without a trailing slash or /api. */
function normalizeOllamaEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "").replace(/\/api$/, "");
}

/**
 * Create AI model instances from configuration.
 * The AI Runtime checks enablement before calling this.
 */
export function createModelsFromConfig(config: {
  provider: AIProvider;
  model: string;
  visionModel?: string;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}): ModelConfig {
  const models = createProviderModels(config);

  // Every AI feature passes the configured temperature. Providers drop it for
  // the models they know; a model newer than the provider package, or one
  // behind a generic endpoint, would otherwise fail rather than answer.
  return {
    ...models,
    model: withTemperatureFallback(models.model),
    visionModel: withTemperatureFallback(models.visionModel),
  };
}

function createProviderModels(config: {
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
      const ollama = createOllama({
        baseURL: normalizeOllamaEndpoint(endpoint),
        fetch: customFetch,
      });

      return {
        model: ollama(model, { structuredOutputs: true }),
        visionModel: ollama(visionModel || model, { structuredOutputs: true }),
        providerName: "Ollama",
      };
    }

    case "lm-studio":
    case "generic-openai": {
      if (!endpoint) throw new Error("Endpoint is required for this provider");

      const providerName = provider === "lm-studio" ? "lmstudio" : "generic-openai";
      const compatible = createOpenAICompatible({
        name: providerName,
        baseURL: normalizeOpenAICompatibleEndpoint(endpoint),
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

      const azure = endpoint
        ? createAzure({ apiKey, baseURL: normalizeAzureEndpoint(endpoint), fetch: customFetch })
        : createAzure({ apiKey, fetch: customFetch });

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

// ============================================================================
// Transcription clients — beside the language models they belong with
// ============================================================================

export interface TranscriptionClientOptions {
  apiKey: string;
  model: string;
  endpoint?: string;
  timeoutMs: number;
}

/**
 * Build a transcription model for the providers the AI SDK serves natively.
 */
export function createTranscriptionModel(
  provider: "openai" | "groq" | "azure",
  { apiKey, model, endpoint, timeoutMs }: TranscriptionClientOptions
): TranscriptionModel {
  const customFetch = createFetchWithTimeout(timeoutMs);

  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey, fetch: customFetch }).transcription(model);

    case "groq":
      return createGroq({ apiKey, fetch: customFetch }).transcription(model);

    case "azure": {
      const azure = endpoint
        ? createAzure({ apiKey, baseURL: normalizeAzureEndpoint(endpoint), fetch: customFetch })
        : createAzure({ apiKey, fetch: customFetch });

      return azure.transcription(model);
    }
  }
}

/**
 * Raw client for OpenAI-compatible transcription endpoints
 * (faster-whisper-server, LocalAI, whisper.cpp) — the AI SDK's
 * openai-compatible provider has no transcription support.
 */
export function createGenericTranscriptionClient({
  apiKey,
  endpoint,
  timeoutMs,
}: Omit<TranscriptionClientOptions, "model">): OpenAI {
  return new OpenAI({
    // These servers are normally run without any auth at all, but openai v7
    // refuses to construct a client without a credential. The placeholder rides
    // along in an Authorization header a keyless endpoint is free to ignore.
    apiKey: apiKey || "no-key",
    ...(endpoint && { baseURL: normalizeOpenAICompatibleEndpoint(endpoint) }),
    fetch: createFetchWithTimeout(timeoutMs),
  });
}

interface OllamaTranscriptionRequest {
  endpoint?: string;
  model: string;
  timeoutMs: number;
  audio: { format: string; data: string };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

/**
 * Transcribe through Ollama's native /api/generate with input_audio — the AI
 * SDK has no transcription route to Ollama.
 */
export async function requestOllamaTranscription({
  endpoint,
  model,
  timeoutMs,
  audio,
}: OllamaTranscriptionRequest): Promise<OllamaGenerateResponse> {
  const baseUrl = endpoint ? normalizeOllamaEndpoint(endpoint) : "http://localhost:11434";
  const doFetch = createFetchWithTimeout(timeoutMs);

  const response = await doFetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "Transcribe the provided audio to plain text.",
      stream: false,
      input_audio: [audio],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");

    throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as OllamaGenerateResponse;
}
