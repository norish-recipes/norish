/**
 * Audio Transcription.
 *
 * Transcribes audio files to text using the configured transcription provider.
 * Supports multiple providers via Vercel AI SDK with consistent AIResult pattern.
 *
 * Supported providers:
 * - openai: Native Whisper API via @ai-sdk/openai
 * - groq: Native Whisper API via @ai-sdk/groq
 * - azure: Native Whisper API via @ai-sdk/azure
 * - generic-openai: OpenAI-compatible endpoints (faster-whisper-server, LocalAI, whisper.cpp)
 * - ollama: Native Ollama API with input_audio for audio-capable models
 */

import type { TranscriptionProvider } from "@/server/db/zodSchemas/server-config";
import type { AIResult } from "./types/result";
import type { Experimental_TranscriptionResult as TranscriptionResult } from "ai";

import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname } from "node:path";

import { experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createAzure } from "@ai-sdk/azure";
import OpenAI from "openai";

import { aiSuccess, aiError, mapErrorToCode, getErrorMessage } from "./types/result";

import { getVideoConfig, getAIConfig } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";
import { isCloudTranscriptionProvider } from "@/server/db/zodSchemas/server-config";

// ============================================================================
// Shared Helpers
// ============================================================================

/**
 * Log transcription start.
 */
function logStart(
  provider: string,
  audioPath: string,
  model: string,
  extra?: Record<string, unknown>
): void {
  aiLogger.debug(
    { audioPath, model, provider, ...extra },
    `Starting transcription with ${provider}`
  );
}

/**
 * Log AI SDK transcription completion.
 */
function logAISDKCompletion(provider: string, result: TranscriptionResult): void {
  aiLogger.debug(
    {
      provider,
      durationSeconds: result.durationInSeconds,
      language: result.language,
      segmentCount: result.segments?.length,
    },
    `${provider} transcription completed`
  );
}

/**
 * Validate transcript text and return AIResult.
 */
function validateTranscript(text: string | undefined): AIResult<string> {
  const transcript = text?.trim() || "";

  if (!transcript) {
    return aiError("Transcription returned empty text", "EMPTY_RESPONSE");
  }

  return aiSuccess(transcript);
}

/**
 * Get audio format from file extension.
 */
function getAudioFormat(audioPath: string): string {
  const ext = extname(audioPath).toLowerCase().replace(".", "");
  const formatMap: Record<string, string> = {
    mp3: "mp3",
    wav: "wav",
    m4a: "m4a",
    ogg: "ogg",
    flac: "flac",
    webm: "webm",
    aac: "aac",
  };

  return formatMap[ext] || "wav";
}

// ============================================================================
// Provider-specific transcription implementations
// ============================================================================

/**
 * Transcribe using OpenAI's native Whisper API via AI SDK.
 */
async function transcribeWithOpenAI(
  audioPath: string,
  apiKey: string,
  model: string
): Promise<AIResult<string>> {
  logStart("OpenAI", audioPath, model);

  const openai = createOpenAI({ apiKey });
  const audioData = await readFile(audioPath);

  const result = await transcribe({
    model: openai.transcription(model),
    audio: audioData,
    providerOptions: { openai: { language: "en" } },
  });

  logAISDKCompletion("OpenAI", result);

  return validateTranscript(result.text);
}

/**
 * Transcribe using Groq's native Whisper API via AI SDK.
 */
async function transcribeWithGroq(
  audioPath: string,
  apiKey: string,
  model: string
): Promise<AIResult<string>> {
  logStart("Groq", audioPath, model);

  const groq = createGroq({ apiKey });
  const audioData = await readFile(audioPath);

  const result = await transcribe({
    model: groq.transcription(model),
    audio: audioData,
    providerOptions: { groq: { language: "en" } },
  });

  logAISDKCompletion("Groq", result);

  return validateTranscript(result.text);
}

/**
 * Transcribe using Azure OpenAI's Whisper API via AI SDK.
 */
async function transcribeWithAzure(
  audioPath: string,
  apiKey: string,
  model: string,
  endpoint?: string
): Promise<AIResult<string>> {
  logStart("Azure", audioPath, model, { endpoint });
  let azure;

  if (endpoint) {
    let baseUrl = endpoint.replace(/\/+$/, "");

    // Ensure /openai path is included for SDK compatibility
    if (!baseUrl.endsWith("/openai")) {
      baseUrl = `${baseUrl}/openai`;
    }

    azure = createAzure({ apiKey, baseURL: baseUrl });
  } else {
    azure = createAzure({ apiKey });
  }

  const audioData = await readFile(audioPath);

  const result = await transcribe({
    model: azure.transcription(model),
    audio: audioData,
  });

  logAISDKCompletion("Azure", result);

  return validateTranscript(result.text);
}

/**
 * Transcribe using OpenAI-compatible endpoint (e.g., local Whisper server).
 * Falls back to direct OpenAI client since @ai-sdk/openai-compatible doesn't support transcription.
 */
async function transcribeWithGenericOpenAI(
  audioPath: string,
  apiKey: string,
  model: string,
  endpoint?: string
): Promise<AIResult<string>> {
  let baseURL = endpoint;

  if (baseURL) {
    baseURL = baseURL.replace(/\/+$/, "");
    if (!baseURL.endsWith("/v1")) {
      baseURL = `${baseURL}/v1`;
    }
  }

  logStart("generic-openai", audioPath, model, { endpoint: baseURL });

  const client = new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
  });

  const response = await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model,
    language: "en",
    response_format: "json",
  });

  aiLogger.debug({ provider: "generic-openai" }, "Generic OpenAI transcription completed");

  return validateTranscript(response.text);
}

/**
 * Ollama API response type for /api/generate.
 */
interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Transcribe using Ollama's native API with input_audio.
 * Uses /api/generate endpoint with audio-capable models (e.g., whisper variants).
 */
async function transcribeWithOllama(
  audioPath: string,
  model: string,
  endpoint?: string
): Promise<AIResult<string>> {
  const baseUrl = endpoint?.replace(/\/+$/, "") || "http://localhost:11434";
  const audioFormat = getAudioFormat(audioPath);

  logStart("Ollama", audioPath, model, { endpoint: baseUrl, audioFormat });

  const audioBuffer = await readFile(audioPath);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: "Transcribe the provided audio to plain text.",
      stream: false,
      input_audio: [{ format: audioFormat, data: audioBuffer.toString("base64") }],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");

    aiLogger.error({ status: response.status, error: errorText }, "Ollama transcription failed");

    return aiError(`Ollama API error: ${response.status} - ${errorText}`, "PROVIDER_ERROR");
  }

  const result = (await response.json()) as OllamaGenerateResponse;

  aiLogger.debug(
    {
      provider: "Ollama",
      model: result.model,
      evalCount: result.eval_count,
      totalDuration: result.total_duration,
    },
    "Ollama transcription completed"
  );

  return validateTranscript(result.response);
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Transcribe an audio file to text.
 *
 * @param audioPath - Path to the audio file to transcribe.
 * @returns AIResult with the transcribed text on success, or error details on failure.
 */
export async function transcribeAudio(audioPath: string): Promise<AIResult<string>> {
  try {
    const [videoConfig, aiConfig] = await Promise.all([getVideoConfig(true), getAIConfig(true)]);

    if (!videoConfig?.enabled) {
      return aiError("Video parsing is not enabled. Enable it in admin settings.", "AI_DISABLED");
    }

    const provider: TranscriptionProvider = videoConfig.transcriptionProvider;

    if (provider === "disabled") {
      return aiError(
        "Transcription is disabled. Configure a transcription provider in admin settings.",
        "AI_DISABLED"
      );
    }

    const model = videoConfig.transcriptionModel || "whisper-1";
    const endpoint = videoConfig.transcriptionEndpoint || aiConfig?.endpoint;
    // API key is optional for generic-openai (local models like Ollama/LM Studio don't need it)
    const apiKey = videoConfig.transcriptionApiKey || aiConfig?.apiKey || "";

    // For cloud providers, we need an API key
    if (!apiKey && isCloudTranscriptionProvider(provider)) {
      return aiError(
        "No API key configured for transcription. Set it in admin settings.",
        "AUTH_ERROR"
      );
    }

    switch (provider) {
      case "openai":
        return await transcribeWithOpenAI(audioPath, apiKey, model);

      case "groq":
        return await transcribeWithGroq(audioPath, apiKey, model);

      case "azure":
        return await transcribeWithAzure(audioPath, apiKey, model, endpoint);

      case "generic-openai":
        // API key is optional for local models (faster-whisper-server, LocalAI, etc.)
        return await transcribeWithGenericOpenAI(audioPath, apiKey, model, endpoint);

      case "ollama":
        // Ollama uses native API with input_audio, no API key needed
        return await transcribeWithOllama(audioPath, model, endpoint);

      default:
        return aiError(`Unknown transcription provider: ${provider}`, "PROVIDER_ERROR");
    }
  } catch (error: unknown) {
    aiLogger.error({ err: error }, "Transcription failed");

    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : "Unknown error");

    return aiError(message, code);
  }
}
