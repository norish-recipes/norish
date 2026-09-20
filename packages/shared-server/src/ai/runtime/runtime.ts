/**
 * The AI Runtime — the single seam through which Norish issues a model
 * request.
 *
 * Four entry points, because Norish makes four genuinely different kinds of
 * request: structured generation, transcription, image generation, and a
 * Decision (ADR-0015, ADR-0024, ADR-0035). All are built on the shared
 * transport. The runtime
 * owns what every caller would otherwise do for itself: the enabled check,
 * model selection, Generation Preferences, the model call, token logging, and
 * turning provider failures into typed errors.
 *
 * A feature never constructs a provider client, never reads Generation
 * Preferences, and never calls the SDK. It passes the name of an
 * administrator-editable prompt plus the sections it wants appended — never a
 * finished prompt string — so a feature cannot ship a hardcoded prompt,
 * because there is no parameter to pass one through. A Decision is the one
 * request with no prompt at all: its questions' criteria are the domain's own
 * option set, and their instructions are code-owned like the system messages.
 */

import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { z } from "zod";
import {
  asSchema,
  experimental_evaluate as evaluate,
  generateImage as generateImageWithModel,
  generateText,
  Output,
  transcribe as transcribeWithModel,
} from "ai";

import type {
  AIConfig,
  DecisionConfig,
  DecisionProvider,
  TranscriptionProvider,
} from "@norish/config/zod/server-config";
import {
  isCloudTranscriptionProvider,
  isDecisionConfigValid,
  isImageGenerationConfigValid,
  resolveDecisionSettings,
  resolveImageGenerationSettings,
} from "@norish/config/zod/server-config";
import {
  getAIConfig,
  getDecisionConfig,
  getImageGenerationConfig,
  getVideoConfig,
} from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { PromptName } from "../prompts/loader";
import { fillPrompt, loadPrompt } from "../prompts/loader";
import {
  AIConfigurationError,
  AIDisabledError,
  AIProviderError,
  AIResponseError,
  isCredentialRejection,
  isRequestShapeRejection,
  toAIError,
} from "./errors";
import {
  canDegradeToJsonMode,
  createDecisionModelFromConfig,
  createGenericTranscriptionClient,
  createImageModelFromConfig,
  createModelsFromConfig,
  createTranscriptionModel,
  requestOllamaTranscription,
} from "./providers";

// ============================================================================
// System messages — code-owned, keyed by the prompt they accompany
// ============================================================================

/**
 * Prompts that start a structured-generation request. The image style prompt
 * is the one exception: it is sent to an image model, which takes a single
 * prompt and no system turn, so it can never be the base of a structured
 * request and needs no system message.
 */
export type StructuredPromptName = Exclude<PromptName, "image-generation-style">;

/**
 * System messages are not configuration. They encode invariants the code
 * depends on: schema-parseable output, and Recipe Provenance's deliberate
 * silence about language — a system message naming a language would override
 * the prompt's inference from the recipe. An administrator's intent is
 * already expressible in the prompt, which follows the system message.
 */
const SYSTEM_MESSAGES: Record<StructuredPromptName, string> = {
  "recipe-extraction": "You extract recipe data as JSON-LD with both metric and US measurements.",
  "image-extraction":
    "You extract recipe data from images as JSON-LD with both metric and US measurements.",
  "unit-conversion": "Convert recipe measurements between metric and US systems.",
  "nutrition-estimation":
    "Estimate nutritional values for this recipe based on the ingredients. Return accurate per-serving values.",
  "auto-tagging":
    "You are a recipe tagging assistant. Analyze the recipe and assign relevant tags based on the provided rules.",
  "auto-categorization":
    "You are a culinary assistant that assigns breakfast/lunch/dinner/snack categories to recipes.",
  "allergy-detection":
    "You are an allergy detection assistant. Analyze recipe ingredients to identify allergens. Be accurate and only report allergens that are definitely present.",
  // Deliberately no language instruction: the prompt decides the note's
  // language from the recipe, and a system message naming one would win.
  "recipe-provenance":
    "You are a culinary historian who places dishes in their country and region of origin.",
  "ingredient-linking":
    "You are a careful recipe reader who says which ingredient lines each step uses, and only what the text supports.",
  // English by instruction, not by system message alone: the brief is a model
  // instruction rather than recipe content, so ADR-0018's language care does
  // not apply to it.
  "image-generation-brief":
    "You write short visual briefs that tell an image model what a finished dish looks like.",
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
  prompt: StructuredPromptName;
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
 * What a plain-JSON request has to carry that a schema-constrained one does
 * not: the shape itself. `json_object` mode only promises valid JSON, so
 * without this the model answers something parseable and wrong.
 *
 * Code-owned like the system messages, and appended to one rather than to the
 * administrator's prompt: it is an invariant of the transport, not an
 * instruction anyone should be able to edit away.
 */
async function jsonModeInstruction<T>(schema: z.ZodType<T>): Promise<string> {
  const jsonSchema = await asSchema(schema).jsonSchema;

  return [
    "Answer with a single JSON object and nothing else: no prose, no code fence.",
    "It must validate against this JSON Schema:",
    JSON.stringify(jsonSchema),
  ].join("\n");
}

interface ObjectRequest<T> {
  config: AIConfig;
  promptName: StructuredPromptName;
  prompt: string;
  schema: z.ZodType<T>;
  images: readonly AIImage[];
  /**
   * Ask for plain `json_object` output and carry the schema in the system
   * message, rather than asking the endpoint to enforce a JSON schema.
   */
  jsonMode: boolean;
}

/** One model round trip, in whichever structured-output mode was asked for. */
async function requestObject<T>({
  config,
  promptName,
  prompt,
  schema,
  images,
  jsonMode,
}: ObjectRequest<T>): Promise<T> {
  const { model, visionModel, providerName } = createModelsFromConfig(config, {
    structuredOutputs: !jsonMode,
  });

  // Vision selection is implicit: the presence of images selects the vision
  // model, so images cannot be silently dropped by a forgotten flag.
  const useVision = images.length > 0;
  const instructions = jsonMode
    ? `${SYSTEM_MESSAGES[promptName]}\n\n${await jsonModeInstruction(schema)}`
    : SYSTEM_MESSAGES[promptName];

  aiLogger.debug(
    {
      feature: promptName,
      provider: providerName,
      promptLength: prompt.length,
      images: images.length,
      jsonMode,
    },
    "Sending AI request"
  );

  const result = await generateText({
    model: useVision ? visionModel : model,
    output: Output.object({ schema }),
    instructions,
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
                  type: "file" as const,
                  data: image.data,
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
}

/** Log a failed request once, as the typed error the caller will see. */
function reportFailure(promptName: StructuredPromptName, error: unknown): never {
  const aiError = toAIError(error);

  aiLogger.error(
    { err: error, feature: promptName, retryable: aiError.retryable },
    "AI request failed"
  );

  throw aiError;
}

/**
 * Issue one structured-generation request and return the validated output.
 *
 * Throws an {@link AIError} on failure. The SDK's structured-output strategy
 * parses and validates against the schema and throws on either failure, so
 * this never returns an unvalidated object — callers keep only their own
 * domain rules.
 *
 * A generic OpenAI-compatible endpoint gets a second chance: what sits behind
 * a typed base URL decides whether a strict `json_schema` request is servable
 * at all, and an aggregator reports that as a routing failure blaming the
 * account's settings. So a refused request shape is retried once in plain JSON
 * mode with the schema in the prompt, which most models handle, and only a
 * second refusal is reported — naming the missing capability rather than the
 * aggregator's guess, and not worth another queue attempt (#538).
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
  const request = { config, promptName, prompt, schema, images };

  try {
    return await requestObject({ ...request, jsonMode: false });
  } catch (error) {
    if (!canDegradeToJsonMode(config.provider) || !isRequestShapeRejection(error)) {
      reportFailure(promptName, error);
    }

    aiLogger.warn(
      { err: error, feature: promptName, provider: config.provider },
      "Endpoint refused a JSON-schema request, retrying in plain JSON mode"
    );

    try {
      return await requestObject({ ...request, jsonMode: true });
    } catch (fallbackError) {
      if (!isRequestShapeRejection(fallbackError)) reportFailure(promptName, fallbackError);

      aiLogger.error(
        { err: fallbackError, feature: promptName, provider: config.provider },
        "Endpoint served neither JSON-schema nor plain JSON output"
      );

      throw new AIProviderError(
        "The configured AI endpoint could not serve a structured response: it refused both a " +
          "JSON schema request and a plain JSON one. If the endpoint is an aggregator, the " +
          "models it is allowed to route to must support JSON output.",
        { retryable: false, cause: fallbackError }
      );
    }
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
      const result = await transcribeWithModel({
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

// ============================================================================
// Image generation (ADR-0024)
// ============================================================================

export interface GenerateImageOptions {
  /** The administrator-editable prompt the request starts from. */
  prompt: "image-generation-style";
  /** Input blocks appended after the prompt, blank-line separated (ADR-0016). */
  sections?: readonly string[];
}

export interface GeneratedImageBytes {
  bytes: Buffer;
  mediaType: string;
}

/**
 * Issue one image-generation request and return the drawn bytes.
 *
 * Reads the Image Generation block rather than the server's AI provider
 * (ADR-0024), with endpoint and key falling back to the AI configuration when
 * the provider matches. The provider is asked for its widest supported
 * landscape; cropping to the stored size is the save path's job. There is no
 * image timeout: the request runs under the existing AI timeout on the shared
 * transport (ADR-0015).
 *
 * Throws an {@link AIError} on failure: disabled AI and a missing or invalid
 * image configuration never retry, an empty or unusable image always does,
 * and provider failures follow the SDK's own retryability.
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImageBytes> {
  const { prompt: promptName, sections = [] } = options;

  const [aiConfig, imageConfig] = await Promise.all([
    getAIConfig(true),
    getImageGenerationConfig(true),
  ]);

  if (!aiConfig?.enabled) {
    aiLogger.info({ feature: promptName }, "AI features are disabled, refusing AI request");
    throw new AIDisabledError();
  }

  if (
    !imageConfig ||
    imageConfig.provider === "disabled" ||
    !imageConfig.model?.trim() ||
    !isImageGenerationConfigValid(imageConfig, aiConfig)
  ) {
    throw new AIConfigurationError(
      "No image provider is configured. Set one in the admin settings."
    );
  }

  const provider = imageConfig.provider;
  const { endpoint, apiKey } = resolveImageGenerationSettings(imageConfig, aiConfig);
  const model = imageConfig.model.trim();

  const basePrompt = await loadPrompt(promptName);
  const prompt = [basePrompt, ...sections].join("\n\n");

  try {
    const imageModel = createImageModelFromConfig({
      provider,
      model,
      endpoint,
      apiKey,
      timeoutMs: aiConfig.timeoutMs,
    });

    aiLogger.debug(
      { feature: promptName, provider: imageModel.providerName, promptLength: prompt.length },
      "Sending image generation request"
    );

    const result = await generateImageWithModel({
      model: imageModel.model,
      prompt,
      ...imageModel.landscape,
      // Image calls are billed per request, so the SDK's silent in-call
      // retries are disabled: the queue's attempts are the one retry budget.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(aiConfig.timeoutMs),
    });

    const bytes = Buffer.from(result.image.uint8Array);

    if (bytes.length === 0) {
      throw new AIResponseError("The model returned no usable image.");
    }

    aiLogger.info(
      {
        feature: promptName,
        provider: imageModel.providerName,
        model,
        imageBytes: bytes.length,
      },
      "Image generation completed"
    );

    return { bytes, mediaType: result.image.mediaType };
  } catch (error) {
    const aiError = toAIError(error);

    aiLogger.error(
      { err: error, feature: promptName, provider, model, retryable: aiError.retryable },
      "Image generation failed"
    );

    throw aiError;
  }
}

// ============================================================================
// Decisions (ADR-0035)
// ============================================================================

/** A JSON value a feature may put into a Decision's state. */
export type DecisionJson =
  | string
  | number
  | boolean
  | null
  | readonly DecisionJson[]
  | { readonly [key: string]: DecisionJson };

/**
 * What a Decision is asked about: text, or the feature's own structured
 * input — the analogue of its Prompt Sections, composed by the feature and
 * structured where the recipe is structured, never a finished prose prompt.
 */
export type DecisionState = string | { readonly [key: string]: DecisionJson };

/** Pick one of up to 255 named options. The labels are the answer schema. */
export interface DecisionChoiceQuestion<Label extends string = string> {
  readonly type: "choice";
  readonly instructions: string;
  /** Option label to its description, or null for none. */
  readonly criteria: Readonly<Record<Label, string | null>>;
}

/** Place the state on an ordered rubric of two to ten levels, lowest first. */
export interface DecisionScoreQuestion {
  readonly type: "score";
  readonly instructions: string;
  readonly criteria: readonly (string | null)[];
}

/** Yes or no, answered as the probability of yes. */
export interface DecisionBooleanQuestion {
  readonly type: "boolean";
  readonly instructions: string;
  readonly criteria?: { readonly true?: string | null; readonly false?: string | null };
}

export type DecisionQuestion =
  DecisionChoiceQuestion | DecisionScoreQuestion | DecisionBooleanQuestion;

/** The questions of one Decision, keyed by the ids their answers come back under. */
export type DecisionQuestions = Record<string, DecisionQuestion>;

/**
 * One answer: the pick, the full distribution the pick was read from, and
 * TypeSafe's separate confidence statistic where the provider reports one.
 * No threshold lives here — how sure is sure enough is the feature's constant.
 */
export type DecisionAnswer<Q extends DecisionQuestion> = Q extends {
  type: "choice";
  criteria: infer Criteria;
}
  ? {
      type: "choice";
      choice: Extract<keyof Criteria, string>;
      probabilities: Record<Extract<keyof Criteria, string>, number>;
      confidence?: number;
    }
  : Q extends { type: "score" }
    ? {
        type: "score";
        /** Fractional position in [0, levels - 1]: the probability-weighted mean. */
        score: number;
        /** Keyed by zero-based level index. */
        probabilities: Record<string, number>;
        confidence?: number;
      }
    : {
        type: "boolean";
        /** P(true), in [0, 1]. */
        probability: number;
      };

export interface DecisionResult<Q extends DecisionQuestions> {
  answers: { [Id in keyof Q]: DecisionAnswer<Q[Id]> };
  /** The model that answered — the release behind `jev-latest`, for instance. */
  model: string;
}

export interface DecideOptions<Q extends DecisionQuestions> {
  /**
   * The feature's identity: labels the log line and names the caller. No
   * Prompt is loaded — a Decision has none (ADR-0035).
   */
  feature: string;
  state: DecisionState;
  questions: Q;
}

/** The answer shape the SDK hands back, before it is typed per question. */
type ProviderAnswer =
  | { type: "choice"; choice: string; probabilities?: Record<string, number> }
  | { type: "score"; score: number; probabilities?: Record<string, number> }
  | { type: "boolean"; probability: number };

/** TypeSafe's per-question confidence, read from the provider metadata it publishes. */
function readConfidence(metadata: unknown): Record<string, number> {
  const typesafe =
    metadata && typeof metadata === "object" && "typesafe" in metadata
      ? (metadata as { typesafe?: unknown }).typesafe
      : undefined;
  const confidence =
    typesafe && typeof typesafe === "object" && "confidence" in typesafe
      ? (typesafe as { confidence?: unknown }).confidence
      : undefined;

  if (!confidence || typeof confidence !== "object") return {};

  return Object.fromEntries(
    Object.entries(confidence as Record<string, unknown>).flatMap(([id, value]) =>
      typeof value === "number" ? [[id, value]] : []
    )
  );
}

interface DecisionRequest<Q extends DecisionQuestions> {
  feature: string;
  state: DecisionState;
  questions: Q;
  settings: {
    provider: Exclude<DecisionProvider, "disabled">;
    apiKey?: string;
    model: string;
    endpoint: string;
  };
  timeoutMs: number;
}

/** One Decision Model round trip: every question asked together, every answer typed. */
async function requestDecision<Q extends DecisionQuestions>({
  feature,
  state,
  questions,
  settings,
  timeoutMs,
}: DecisionRequest<Q>): Promise<DecisionResult<Q>> {
  const decisionModel = createDecisionModelFromConfig({ ...settings, timeoutMs });
  const asked: DecisionQuestions = questions;

  // The state is the recipe (or the page), so it stays out of the log.
  aiLogger.debug(
    {
      feature,
      provider: decisionModel.providerName,
      model: settings.model,
      questions: Object.keys(asked),
    },
    "Sending Decision request"
  );

  const result = await evaluate({
    model: decisionModel.model,
    state,
    questions: asked,
    abortSignal: AbortSignal.timeout(timeoutMs),
    // Like image generation, the SDK's silent in-call retries are off: the
    // queue's attempts are the one retry budget.
    maxRetries: 0,
  });

  const confidence = readConfidence(result.providerMetadata);
  const answers: Record<string, DecisionAnswer<DecisionQuestion>> = {};

  for (const id of Object.keys(asked)) {
    const answer: ProviderAnswer | undefined = result.answers[id];

    if (!answer) {
      throw new AIResponseError(`The Decision Model did not answer "${id}".`);
    }

    switch (answer.type) {
      case "choice":
        if (!answer.probabilities) {
          throw new AIResponseError(`The Decision Model gave no distribution for "${id}".`);
        }
        answers[id] = {
          type: "choice",
          choice: answer.choice,
          probabilities: answer.probabilities,
          ...(confidence[id] !== undefined ? { confidence: confidence[id] } : {}),
        };
        break;
      case "score":
        if (!answer.probabilities) {
          throw new AIResponseError(`The Decision Model gave no distribution for "${id}".`);
        }
        answers[id] = {
          type: "score",
          score: answer.score,
          probabilities: answer.probabilities,
          ...(confidence[id] !== undefined ? { confidence: confidence[id] } : {}),
        };
        break;
      case "boolean":
        answers[id] = { type: "boolean", probability: answer.probability };
        break;
    }
  }

  aiLogger.info(
    {
      feature,
      provider: decisionModel.providerName,
      model: result.response.modelId,
      questions: Object.keys(asked).length,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
    },
    "Decision completed"
  );

  return {
    // Built one question at a time above; the mapped type is what that loop
    // guarantees, keyed exactly as the questions were.
    answers: answers as DecisionResult<Q>["answers"],
    model: result.response.modelId,
  };
}

/**
 * Ask the Decision Model every question at once and return typed answers
 * with their full distributions.
 *
 * Reads the Decision block rather than the server's AI provider (ADR-0035),
 * follows the global AI switch, and runs under the one AI timeout on the
 * shared transport (ADR-0015). Thresholds belong to the feature: nothing here
 * decides whether an answer is sure enough.
 *
 * Throws an {@link AIError} on failure: disabled AI and a missing block never
 * retry, an answer that does not match the questions always does, and
 * provider failures follow the SDK's own retryability. A feature that has a
 * fallback catches all of them alike and takes it.
 */
export async function decide<const Q extends DecisionQuestions>(
  options: DecideOptions<Q>
): Promise<DecisionResult<Q>> {
  const { feature, state, questions } = options;

  const [aiConfig, decisionConfig] = await Promise.all([
    getAIConfig(true),
    getDecisionConfig(true),
  ]);

  if (!aiConfig?.enabled) {
    aiLogger.info({ feature }, "AI features are disabled, refusing AI request");
    throw new AIDisabledError();
  }

  if (!isDecisionConfigValid(decisionConfig)) {
    throw new AIConfigurationError(
      "No Decision Model is configured. Set one in the admin settings."
    );
  }

  const settings = {
    ...resolveDecisionSettings(decisionConfig),
    provider: decisionConfig.provider,
  };

  try {
    return await requestDecision({
      feature,
      state,
      questions,
      settings,
      timeoutMs: aiConfig.timeoutMs,
    });
  } catch (error) {
    const aiError = toAIError(error);

    // Warn, not error: every feature that decides has a fallback and says at
    // its own level what the failure meant, so the runtime's line is the
    // provider detail beside it, not a second alarm for a handled case.
    aiLogger.warn(
      {
        err: error,
        feature,
        provider: settings.provider,
        model: settings.model,
        retryable: aiError.retryable,
      },
      "Decision failed"
    );

    throw aiError;
  }
}

/** How long the admin's Test button waits, whatever the AI timeout is tuned to. */
const DECISION_TEST_TIMEOUT_MS = 15_000;

/**
 * The admin form's Test button: one trivial Boolean question against the
 * settings as typed, not as stored, so a typo is caught before a queue
 * worker discovers it. Answers success or the provider's own reason, and
 * follows the global AI switch like every other request.
 */
export async function testDecisionModel(
  config: Pick<DecisionConfig, "provider" | "apiKey" | "model" | "endpoint">
): Promise<{ success: boolean; error?: string }> {
  const aiConfig = await getAIConfig(true);

  if (!aiConfig?.enabled) {
    return { success: false, error: new AIDisabledError().message };
  }

  if (config.provider === "disabled") {
    return { success: false, error: "Select a Decision Model provider first." };
  }

  if (!config.apiKey) {
    return { success: false, error: "An API key is required for TypeSafe AI." };
  }

  const settings = { ...resolveDecisionSettings(config), provider: config.provider };

  try {
    await requestDecision({
      feature: "decision-model-test",
      state: "test",
      questions: { isTest: { type: "boolean", instructions: "Is this a test?" } },
      settings,
      timeoutMs: Math.min(aiConfig.timeoutMs, DECISION_TEST_TIMEOUT_MS),
    });

    return { success: true };
  } catch (error) {
    aiLogger.warn(
      { err: error, provider: settings.provider, model: settings.model },
      "Decision Model test failed"
    );

    if (isCredentialRejection(error)) {
      return { success: false, error: "The Decision Model provider rejected the API key." };
    }

    return { success: false, error: toAIError(error).message };
  }
}
