/**
 * The AI Runtime — the single seam through which Norish issues a model
 * request.
 *
 * Two entry points, because Norish makes two genuinely different kinds of
 * request: structured generation and transcription. Both are built on the
 * shared transport. The runtime owns what every caller would otherwise do for
 * itself: the enabled check, model selection, Generation Preferences, the
 * model call, token logging, and turning provider failures into typed errors.
 *
 * A feature never constructs a provider client, never reads Generation
 * Preferences, and never calls the SDK. It passes the name of an
 * administrator-editable prompt plus the sections it wants appended — never a
 * finished prompt string — so a feature cannot ship a hardcoded prompt,
 * because there is no parameter to pass one through.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { z } from "zod";
import { experimental_transcribe, generateText, Output } from "ai";

import type { TranscriptionProvider } from "@norish/config/zod/server-config";
import { isCloudTranscriptionProvider } from "@norish/config/zod/server-config";
import { getAIConfig, getVideoConfig } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { PromptName } from "../prompts/loader";
import { fillPrompt, loadPrompt } from "../prompts/loader";
import { AIConfigurationError, AIDisabledError, AIResponseError, toAIError } from "./errors";
import {
  createGenericTranscriptionClient,
  createModelsFromConfig,
  createTranscriptionModel,
  requestOllamaTranscription,
} from "./providers";

// ============================================================================
// System messages — code-owned, keyed by the prompt they accompany
// ============================================================================

/**
 * System messages are not configuration. They encode invariants the code
 * depends on: schema-parseable output, and Recipe Provenance's deliberate
 * silence about language — a system message naming a language would override
 * the prompt's inference from the recipe. An administrator's intent is
 * already expressible in the prompt, which follows the system message.
 */
const SYSTEM_MESSAGES: Record<PromptName, string> = {
  "recipe-extraction": "You extract recipe data as JSON-LD with both metric and US measurements.",
  "unit-conversion": "Convert recipe measurements between metric and US systems.",
  "nutrition-estimation":
    "Estimate nutritional values for this recipe based on the ingredients. Return accurate per-serving values.",
  "auto-tagging":
    "You are a recipe tagging assistant. Analyze the recipe and assign relevant tags based on the provided rules.",
  // Deliberately no language instruction: the prompt decides the note's
  // language from the recipe, and a system message naming one would win.
  "recipe-provenance":
    "You are a culinary historian who places dishes in their country and region of origin.",
  "ingredient-linking":
    "You are a careful recipe reader who says which ingredient lines each step uses, and only what the text supports.",
};

// ============================================================================
// Structured generation
// ============================================================================

/** An image handed to the vision model, base64-encoded. */
export interface AIImage {
  data: string;
  mimeType: string;
}

export interface GenerateOptions<T> {
  /**
   * The feature's identity: names the administrator-editable prompt the
   * request starts from, and labels its log line.
   */
  prompt: PromptName;
  /**
   * The output schema, as a value: Recipe Provenance builds its schema per
   * request from the administrator's current Cuisine vocabulary.
   */
  schema: z.ZodType<T>;
  /**
   * Input blocks appended after the prompt, blank-line separated — never
   * interpolated into it, so an administrator's customised prompt keeps
   * working when a feature's input changes shape.
   */
  sections?: readonly string[];
  /**
   * Values for the `{{placeholders}}` the named prompt has historically
   * carried. New prompts append sections instead of adding placeholders.
   */
  fill?: Record<string, string>;
  /** Images to read. Their presence is what selects the vision model. */
  images?: readonly AIImage[];
}

/**
 * Issue one structured-generation request and return the validated output.
 *
 * Throws an {@link AIError} on failure. The SDK's structured-output strategy
 * parses and validates against the schema and throws on either failure, so
 * this never returns an unvalidated object — callers keep only their own
 * domain rules.
 */
export async function generateStructured<T>(options: GenerateOptions<T>): Promise<T> {
  const { prompt: promptName, schema, sections = [], fill, images = [] } = options;

  const config = await getAIConfig(true);

  if (!config?.enabled) {
    aiLogger.info({ feature: promptName }, "AI features are disabled, refusing AI request");
    throw new AIDisabledError();
  }

  const basePrompt = await loadPrompt(promptName);
  const filled = fill ? fillPrompt(basePrompt, fill) : basePrompt;
  const prompt = [filled, ...sections].join("\n\n");

  try {
    const { model, visionModel, providerName } = createModelsFromConfig(config);

    // Vision selection is implicit: the presence of images selects the vision
    // model, so images cannot be silently dropped by a forgotten flag.
    const useVision = images.length > 0;

    aiLogger.debug(
      {
        feature: promptName,
        provider: providerName,
        promptLength: prompt.length,
        images: images.length,
      },
      "Sending AI request"
    );

    const result = await generateText({
      model: useVision ? visionModel : model,
      output: Output.object({ schema }),
      system: SYSTEM_MESSAGES[promptName],
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      abortSignal: AbortSignal.timeout(config.timeoutMs),
      ...(useVision
        ? {
            messages: [
              {
                role: "user" as const,
                content: [
                  { type: "text" as const, text: prompt },
                  ...images.map((image) => ({
                    type: "image" as const,
                    image: image.data,
                    mediaType: image.mimeType,
                  })),
                ],
              },
            ],
          }
        : { prompt }),
    });

    aiLogger.info(
      {
        feature: promptName,
        provider: providerName,
        model: useVision ? (config.visionModel ?? config.model) : config.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        totalTokens: result.usage?.totalTokens ?? 0,
      },
      "AI request completed"
    );

    return result.output;
  } catch (error) {
    const aiError = toAIError(error);

    aiLogger.error(
      { err: error, feature: promptName, retryable: aiError.retryable },
      "AI request failed"
    );

    throw aiError;
  }
}

// ============================================================================
// Transcription
// ============================================================================

const AUDIO_FORMATS = new Set(["mp3", "wav", "m4a", "ogg", "flac", "webm", "aac"]);

function getAudioFormat(audioPath: string): string {
  const ext = extname(audioPath).toLowerCase().replace(".", "");

  return AUDIO_FORMATS.has(ext) ? ext : "wav";
}

function requireTranscript(text: string | undefined): string {
  const transcript = text?.trim() || "";

  if (!transcript) {
    throw new AIResponseError("Transcription returned empty text.");
  }

  return transcript;
}

/**
 * Transcribe an audio file to text with the configured transcription
 * provider.
 *
 * Endpoint and API key fall back to the AI configuration when transcription
 * has none of its own, and the request runs under the same AI timeout and
 * shared transport as every other model request — a hung Whisper endpoint
 * gives up instead of holding a worker forever.
 *
 * Throws an {@link AIError} on failure.
 */
export async function transcribe(audioPath: string): Promise<string> {
  const [videoConfig, aiConfig] = await Promise.all([getVideoConfig(true), getAIConfig(true)]);

  if (!videoConfig?.enabled) {
    throw new AIDisabledError("Video parsing is not enabled. Enable it in admin settings.");
  }

  const provider: TranscriptionProvider = videoConfig.transcriptionProvider;

  if (provider === "disabled") {
    throw new AIDisabledError(
      "Transcription is disabled. Configure a transcription provider in admin settings."
    );
  }

  const model = videoConfig.transcriptionModel || "whisper-1";
  const endpoint = videoConfig.transcriptionEndpoint || aiConfig?.endpoint;
  // API key is optional for local providers (Ollama, faster-whisper-server).
  const apiKey = videoConfig.transcriptionApiKey || aiConfig?.apiKey || "";
  // Transcription follows the existing AI timeout; there is no second knob.
  const timeoutMs = aiConfig?.timeoutMs ?? 300_000;

  if (!apiKey && isCloudTranscriptionProvider(provider)) {
    throw new AIConfigurationError(
      "No API key configured for transcription. Set it in admin settings."
    );
  }

  aiLogger.debug({ audioPath, model, provider, endpoint }, "Starting transcription");

  try {
    const transcript = await transcribeWithProvider(provider, {
      audioPath,
      apiKey,
      model,
      endpoint,
      timeoutMs,
    });

    aiLogger.info(
      { provider, model, transcriptLength: transcript.length },
      "Transcription completed"
    );

    return transcript;
  } catch (error) {
    const aiError = toAIError(error);

    aiLogger.error({ err: error, provider, retryable: aiError.retryable }, "Transcription failed");

    throw aiError;
  }
}

interface TranscriptionRequest {
  audioPath: string;
  apiKey: string;
  model: string;
  endpoint?: string;
  timeoutMs: number;
}

async function transcribeWithProvider(
  provider: Exclude<TranscriptionProvider, "disabled">,
  { audioPath, apiKey, model, endpoint, timeoutMs }: TranscriptionRequest
): Promise<string> {
  switch (provider) {
    case "openai":
    case "groq":
    case "azure": {
      const result = await experimental_transcribe({
        model: createTranscriptionModel(provider, { apiKey, model, endpoint, timeoutMs }),
        audio: await readFile(audioPath),
        abortSignal: AbortSignal.timeout(timeoutMs),
      });

      aiLogger.debug(
        {
          provider,
          durationSeconds: result.durationInSeconds,
          language: result.language,
          segmentCount: result.segments?.length,
        },
        "Transcription response received"
      );

      return requireTranscript(result.text);
    }

    case "generic-openai": {
      const client = createGenericTranscriptionClient({ apiKey, endpoint, timeoutMs });

      const response = await client.audio.transcriptions.create(
        { file: createReadStream(audioPath), model, response_format: "json" },
        { signal: AbortSignal.timeout(timeoutMs) }
      );

      return requireTranscript(response.text);
    }

    case "ollama": {
      const audioBuffer = await readFile(audioPath);

      const result = await requestOllamaTranscription({
        endpoint,
        model,
        timeoutMs,
        audio: { format: getAudioFormat(audioPath), data: audioBuffer.toString("base64") },
      });

      aiLogger.debug(
        {
          provider,
          model: result.model,
          evalCount: result.eval_count,
          totalDuration: result.total_duration,
        },
        "Transcription response received"
      );

      return requireTranscript(result.response);
    }
  }
}
