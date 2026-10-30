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
  APICallError,
  asSchema,
  experimental_decide as decideWithModel,
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
  DEFAULT_AI_TIMEOUT_MS,
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
import type { AIError } from "./errors";
import type { ImageTier } from "./providers";
import { fillPrompt, loadPrompt } from "../prompts/loader";
import {
  AIConfigurationError,
  AIDisabledError,
  AIProviderError,
  AIResponseError,
  isCredentialRejection,
  isRequestShapeRejection,
  rateLimitWaitMs,
  toAIError,
} from "./errors";
import {
  imageModelKey,
  isRequestRefusal,
  refusedImageParameter,
  refusedImageParameters,
  refusesLandscape,
  rememberRefusedImageParameter,
  rememberRefusedLandscape,
} from "./image-parameter-fallback";
import { forgetKeyRejection, noteKeyRejection } from "./key-rejections";
import { recordModelUse, requestSignal } from "./model-use-ledger";
import {
  canDegradeToJsonMode,
  createDecisionModelFromConfig,
  createGenericTranscriptionClient,
  createImageModelFromConfig,
  createModelsFromConfig,
  createTranscriptionModel,
  requestOllamaTranscription,
} from "./providers";
import { SYSTEM_MESSAGES as SYSTEM_MESSAGE_TEXTS } from "./system-messages";

// ============================================================================
// System messages — code-owned, keyed by the prompt they accompany
// ============================================================================

/**
 * Prompts that start a structured-generation request. The image style
 * prompts are the exception: they are sent to an image model, which takes a
 * single prompt and no system turn, so they can never be the base of a
 * structured request and need no system message.
 */
export type StructuredPromptName = Exclude<PromptName, ImagePromptName>;

/** The prompts that start an image request: a dish's picture's style, and an Ingredient Icon's. */
export type ImagePromptName = "image-generation-style" | "ingredient-icon-style";

/** Each structured prompt's system message; typed here so a prompt without one fails to compile. */
const SYSTEM_MESSAGES: Record<StructuredPromptName, string> = SYSTEM_MESSAGE_TEXTS;

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
  /** How long this request may take, where the feature's budget is not the AI timeout. */
  timeoutMs?: number;
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

/** A request's answer, with the tokens it took for the model-use ledger. */
interface Answered<T> {
  output: T;
  tokens: number | undefined;
}

/**
 * Input and output together, as the provider reported them. Undefined where
 * it reported none, which the SDK hands on as zero: no request costs nothing.
 */
function reportedTokens(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): number | undefined {
  const tokens = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

  return tokens > 0 ? tokens : undefined;
}

interface ObjectRequest<T> {
  config: AIConfig;
  /** When the request is given up on; the transport keeps the AI timeout. */
  deadlineMs: number;
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
  deadlineMs,
  promptName,
  prompt,
  schema,
  images,
  jsonMode,
}: ObjectRequest<T>): Promise<Answered<T>> {
  const { model, visionModel, providerName } = createModelsFromConfig(config, {
    structuredOutputs: !jsonMode,
  });

  // Vision selection is implicit: the presence of images selects the vision
  // model, so images cannot be silently dropped by a forgotten flag.
  const useVision = images.length > 0;
  // @ai-sdk/mistral puts the schema in the prompt itself once structured outputs are off.
  const instructions =
    jsonMode && config.provider !== "mistral"
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
    abortSignal: requestSignal(deadlineMs),
    // Mistral alone defaults to a non-strict schema, which it treats as a hint (#646).
    providerOptions: {
      mistral: jsonMode ? { structuredOutputs: false } : { strictJsonSchema: true },
    },
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
      model: selectedModelId(config, useVision),
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    },
    "AI request completed"
  );

  return { output: result.output, tokens: result.usage ? reportedTokens(result.usage) : undefined };
}

/**
 * Log a failure as the typed error plus its status code. The raw SDK error
 * carries the request body and response headers, so it is logged at debug only.
 */
function logFailure(
  level: "error" | "warn",
  error: unknown,
  context: Record<string, unknown>,
  message: string
): AIError {
  const aiError = toAIError(error);
  const cause = aiError.cause;

  aiLogger[level](
    {
      ...context,
      err: aiError,
      statusCode: APICallError.isInstance(cause) ? cause.statusCode : undefined,
      retryable: aiError.retryable,
    },
    message
  );
  aiLogger.debug({ ...context, err: error }, `${message}: raw provider error`);

  return aiError;
}

/** Log a failed request once, as the typed error the caller will see. */
function reportFailure(promptName: StructuredPromptName, error: unknown): never {
  throw logFailure("error", error, { feature: promptName }, "AI request failed");
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
 * aggregator's guess, and not worth another queue attempt (#538). Mistral gets
 * the same retry when it refuses a schema in strict mode (#646).
 */
export async function generateStructured<T>(options: GenerateOptions<T>): Promise<T> {
  const { prompt: promptName, schema, sections = [], fill, images = [], timeoutMs } = options;

  const config = await getAIConfig(true);

  if (!config?.enabled) {
    aiLogger.info({ feature: promptName }, "AI features are disabled, refusing AI request");
    throw new AIDisabledError();
  }

  const prompt = await assemblePrompt(promptName, sections, fill);
  const use = { provider: config.provider, model: selectedModelId(config, images.length > 0) };

  // A configuration that cannot build a client is refused here, before the
  // ledger: a missing key is not a request that failed, it is one never sent.
  createModelsFromConfig(config, { structuredOutputs: true });

  // One ledger entry per request a feature made, whichever request shape
  // ended up answering it.
  try {
    const { output, tokens } = await requestStructured({
      config,
      deadlineMs: timeoutMs ?? config.timeoutMs,
      promptName,
      prompt,
      schema,
      images,
    });

    recordModelUse({ ...use, outcome: "completed", ...(tokens === undefined ? {} : { tokens }) });
    forgetKeyRejection("ai_config");

    return output;
  } catch (error) {
    recordModelUse({ ...use, outcome: "failed" });
    noteKeyRejection("ai_config", error);
    throw error;
  }
}

/** The administrator's prompt as it stands, filled, with the feature's sections after it. */
async function assemblePrompt(
  promptName: StructuredPromptName,
  sections: readonly string[],
  fill: Record<string, string> | undefined
): Promise<string> {
  const basePrompt = await loadPrompt(promptName);
  const filled = fill ? fillPrompt(basePrompt, fill) : basePrompt;

  return [filled, ...sections].join("\n\n");
}

/** The model a structured request runs on: the vision model when images ride along. */
function selectedModelId(config: AIConfig, useVision: boolean): string {
  return useVision ? (config.visionModel ?? config.model) : config.model;
}

/** The structured request itself: a strict schema first, a plain-JSON retry where that helps (#538). */
async function requestStructured<T>(request: {
  config: AIConfig;
  deadlineMs: number;
  promptName: StructuredPromptName;
  prompt: string;
  schema: z.ZodType<T>;
  images: readonly AIImage[];
}): Promise<Answered<T>> {
  const { config, promptName } = request;

  try {
    return await requestObject({ ...request, jsonMode: false });
  } catch (error) {
    if (!canDegradeToJsonMode(config.provider) || !isRequestShapeRejection(error)) {
      reportFailure(promptName, error);
    }

    logFailure(
      "warn",
      error,
      { feature: promptName, provider: config.provider },
      "Endpoint refused a JSON-schema request, retrying in plain JSON mode"
    );

    try {
      return await requestObject({ ...request, jsonMode: true });
    } catch (fallbackError) {
      if (!isRequestShapeRejection(fallbackError)) reportFailure(promptName, fallbackError);

      logFailure(
        "error",
        fallbackError,
        { feature: promptName, provider: config.provider },
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
  const timeoutMs = aiConfig?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;

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
    recordModelUse({ provider, model, outcome: "completed" });
    forgetKeyRejection("video_config");

    return transcript;
  } catch (error) {
    const aiError = logFailure("error", error, { provider, model }, "Transcription failed");

    recordModelUse({ provider, model, outcome: "failed" });
    noteKeyRejection("video_config", error);

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
    case "azure":
    case "mistral": {
      const result = await transcribeWithModel({
        model: createTranscriptionModel(provider, { apiKey, model, endpoint, timeoutMs }),
        audio: await readFile(audioPath),
        abortSignal: requestSignal(timeoutMs),
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
        { signal: requestSignal(timeoutMs) }
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
  prompt: ImagePromptName;
  /** Input blocks appended after the prompt, blank-line separated (ADR-0016). */
  sections?: readonly string[];
  /** The picture's shape: a dish's widest landscape (the default), or an icon's square. */
  shape?: "landscape" | "square";
  /**
   * The quality tier asked for where the provider has tiers; omitted leaves
   * the provider's default, as a dish's picture does.
   */
  tier?: ImageTier;
  /** Ask for a transparent background where the provider can draw one: an icon's. */
  transparent?: boolean;
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
 * landscape, or a square, and a tier where it has them; cropping to the
 * stored size is the save path's job. There is no
 * image timeout: the request runs under the existing AI timeout on the shared
 * transport (ADR-0015).
 *
 * Throws an {@link AIError} on failure: disabled AI and a missing or invalid
 * image configuration never retry, an empty or unusable image always does,
 * and provider failures follow the SDK's own retryability.
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImageBytes> {
  const { prompt: promptName, sections = [], shape = "landscape", tier, transparent } = options;

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

    const providerOptions =
      tier || transparent ? imageModel.preferences?.({ tier, transparent }) : undefined;
    const draw = (asked: "landscape" | "square") =>
      generateImageWithModel({
        model: imageModel.model,
        prompt,
        ...imageModel[asked],
        ...(providerOptions ? { providerOptions } : {}),
        // Image calls are billed per request, so the SDK's silent in-call
        // retries are disabled: the queue's attempts are the one retry budget.
        maxRetries: 0,
        abortSignal: requestSignal(aiConfig.timeoutMs),
      });
    const key = imageModelKey(provider, model);
    let asked: "landscape" | "square" =
      shape === "landscape" && refusesLandscape(key) ? "square" : shape;
    let landscapeRefusal: unknown;
    let result: Awaited<ReturnType<typeof draw>> | undefined;

    // A model that refuses a parameter it may go without is asked again
    // without it, once per parameter, and remembers it (ADR-0014). A refused
    // request is not billed.
    while (!result) {
      try {
        result = await draw(asked);
      } catch (error) {
        const refused = refusedImageParameter(error);

        if (refused && !refusedImageParameters(key).has(refused)) {
          aiLogger.warn(
            { feature: promptName, provider, model, parameter: refused },
            "Image model refused a parameter; asking again without it"
          );
          rememberRefusedImageParameter(key, refused);
        } else if (asked === "landscape" && isRequestRefusal(error)) {
          // The refusal names no parameter, so the size is the likely one; if
          // the square is refused too, the landscape's refusal is reported.
          aiLogger.warn(
            { feature: promptName, provider, model },
            "Image model refused the landscape; asking for the square"
          );
          landscapeRefusal = error;
          asked = "square";
        } else {
          throw landscapeRefusal && isRequestRefusal(error) ? landscapeRefusal : error;
        }
      }
    }

    if (landscapeRefusal) rememberRefusedLandscape(key);

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
        // What the provider billed, where it reports it: the way to price a large run.
        usage: result.usage,
      },
      "Image generation completed"
    );
    recordModelUse({ provider, model, outcome: "completed" });
    forgetKeyRejection("image_generation_config");

    return { bytes, mediaType: result.image.mediaType };
  } catch (error) {
    const aiError = toAIError(error);
    const waitMs = rateLimitWaitMs(error);

    // A rate limit is waited out by the caller, not a failure worth a stack.
    if (waitMs !== null) {
      aiLogger.warn(
        { feature: promptName, provider, model, waitMs },
        "Image provider's rate limit"
      );
    } else {
      logFailure(
        "error",
        error,
        { feature: promptName, provider, model },
        "Image generation failed"
      );
    }
    recordModelUse({ provider, model, outcome: "failed" });
    noteKeyRejection("image_generation_config", error);

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
  /** How long this Decision may take, where the feature's budget is not the AI timeout. */
  timeoutMs?: number;
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
  /** When the request is given up on, where not at `timeoutMs`; the transport keeps that. */
  deadlineMs?: number;
}

/** One Decision Model round trip: every question asked together, every answer typed. */
async function requestDecision<Q extends DecisionQuestions>({
  feature,
  state,
  questions,
  settings,
  timeoutMs,
  deadlineMs,
}: DecisionRequest<Q>): Promise<Answered<DecisionResult<Q>>> {
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

  const result = await decideWithModel({
    model: decisionModel.model,
    state,
    questions: asked,
    abortSignal: requestSignal(deadlineMs ?? timeoutMs),
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
    output: {
      // Built one question at a time above; the mapped type is what that loop
      // guarantees, keyed exactly as the questions were.
      answers: answers as DecisionResult<Q>["answers"],
      model: result.response.modelId,
    },
    tokens: reportedTokens(result.usage),
  };
}

/**
 * Ask the Decision Model every question at once and return typed answers
 * with their full distributions.
 *
 * Reads the Decision block rather than the server's AI provider (ADR-0035),
 * so it answers with the global AI switch off, and runs under the one AI
 * timeout on the shared transport (ADR-0015). Thresholds belong to the
 * feature: nothing here decides whether an answer is sure enough.
 *
 * Throws an {@link AIError} on failure: a missing block never retries, an
 * answer that does not match the questions always does, and
 * provider failures follow the SDK's own retryability. A feature that has a
 * fallback catches all of them alike and takes it.
 */
export async function decide<const Q extends DecisionQuestions>(
  options: DecideOptions<Q>
): Promise<DecisionResult<Q>> {
  const { feature, state, questions, timeoutMs } = options;

  const [aiConfig, decisionConfig] = await Promise.all([
    getAIConfig(true),
    getDecisionConfig(true),
  ]);

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
    const { output: result, tokens } = await requestDecision({
      feature,
      state,
      questions,
      settings,
      timeoutMs: aiConfig?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS,
      deadlineMs: timeoutMs,
    });

    // The resolved id, so the job monitor shows the release behind jev-latest.
    recordModelUse({
      provider: settings.provider,
      model: result.model,
      outcome: "completed",
      ...(tokens === undefined ? {} : { tokens }),
    });
    forgetKeyRejection("decision_config");

    return result;
  } catch (error) {
    // Warn, not error: every feature that decides has a fallback and says at
    // its own level what the failure meant, so the runtime's line is the
    // provider detail beside it, not a second alarm for a handled case.
    const aiError = logFailure(
      "warn",
      error,
      { feature, provider: settings.provider, model: settings.model },
      "Decision failed"
    );

    recordModelUse({ provider: settings.provider, model: settings.model, outcome: "failed" });
    noteKeyRejection("decision_config", error);

    throw aiError;
  }
}

/** How long the admin's Test buttons wait, whatever the AI timeout is tuned to. */
const TEST_BUTTON_TIMEOUT_MS = 15_000;

/**
 * The admin form's Test button: one trivial Boolean question against the
 * settings as typed, not as stored, so a typo is caught before a queue
 * worker discovers it. Answers success or the provider's own reason, with the
 * global AI switch on or off, as `decide` does.
 */
export async function testDecisionModel(
  config: Pick<DecisionConfig, "provider" | "apiKey" | "model" | "endpoint">
): Promise<{ success: boolean; error?: string }> {
  const aiConfig = await getAIConfig(true);

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
      timeoutMs: Math.min(aiConfig?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS, TEST_BUTTON_TIMEOUT_MS),
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

/**
 * The AI form's Test button for Perplexity, which lists no models to ask
 * about: one tiny question to its quickest Agent API preset, with the key as
 * typed, through the provider the real requests use.
 */
export async function testPerplexityKey(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const { model } = createModelsFromConfig({
    provider: "perplexity",
    model: "fast",
    apiKey,
    timeoutMs: TEST_BUTTON_TIMEOUT_MS,
  });

  try {
    await generateText({
      model,
      prompt: "Hi",
      maxOutputTokens: 16,
      abortSignal: AbortSignal.timeout(TEST_BUTTON_TIMEOUT_MS),
    });

    return { success: true };
  } catch (error) {
    aiLogger.warn({ err: error, provider: "perplexity" }, "Perplexity test failed");

    if (isCredentialRejection(error)) {
      return { success: false, error: "Invalid API key" };
    }

    return { success: false, error: toAIError(error).message };
  }
}
