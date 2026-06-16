/**
 * AI Executor - Unified AI operation runner.
 *
 * Provides a consistent interface for executing AI operations
 * with proper error handling, logging, and result types.
 */

import type { ZodSchema } from "zod";
import { generateText, Output } from "ai";

import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import { aiLogger } from "@norish/shared-server/logger";

import type { AIResult, ExecuteOptions, ImageContent, MessageContent } from "./types";
import { isAIEnabled } from "./guards";
import { aiError, aiSuccess, getErrorMessage, mapErrorToCode } from "./types";

/**
 * Build message content parts for multimodal requests.
 */
function buildMessageContent(prompt: string, images?: ImageContent[]): MessageContent[] {
  const content: MessageContent[] = [{ type: "text", text: prompt }];

  if (images && images.length > 0) {
    for (const image of images) {
      content.push({
        type: "image",
        image: image.data,
        mediaType: image.mimeType,
      });
    }
  }

  return content;
}

/**
 * Execute an AI operation with structured output.
 *
 * This is the central function for all AI operations. It:
 * - Checks if AI is enabled
 * - Gets the appropriate model and settings
 * - Executes the AI call with proper error handling
 * - Returns a consistent AIResult type
 *
 * @example
 * ```ts
 * const result = await execute({
 *   schema: mySchema,
 *   prompt: "Extract data from this text...",
 *   systemMessage: "You are a helpful assistant.",
 * });
 *
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error, result.code);
 * }
 * ```
 */
export async function execute<T>(options: ExecuteOptions<T>): Promise<AIResult<T>> {
  const { schema, prompt, systemMessage, useVisionModel, images, temperature, maxTokens } = options;

  // Check if AI is enabled
  const enabled = await isAIEnabled();

  if (!enabled) {
    aiLogger.debug("AI features are disabled, skipping execution");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  try {
    // Get models and settings
    const { model, visionModel, providerName } = await getModels();
    const settings = await getGenerationSettings();

    // Select the appropriate model
    const selectedModel = useVisionModel ? visionModel : model;

    aiLogger.debug(
      {
        provider: providerName,
        useVisionModel,
        hasImages: images && images.length > 0,
        promptLength: prompt.length,
      },
      "Executing AI operation"
    );

    // Common options for both text and vision requests
    const commonOptions = {
      model: selectedModel,
      output: Output.object({ schema: schema as ZodSchema }),
      system: systemMessage,
      temperature: temperature ?? settings.temperature,
      maxOutputTokens: maxTokens ?? settings.maxOutputTokens,
      abortSignal: settings.abortSignal,
    };

    // Execute the AI call - use messages format for vision, prompt for text
    let result;

    if (useVisionModel && images && images.length > 0) {
      result = await generateText({
        ...commonOptions,
        messages: [
          {
            role: "user" as const,
            content: buildMessageContent(prompt, images),
          },
        ],
      });
    } else {
      result = await generateText({
        ...commonOptions,
        prompt,
      });
    }

    // Check for empty response
    if (!result.output || Object.keys(result.output).length === 0) {
      aiLogger.warn("AI returned empty response");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    aiLogger.debug(
      {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      },
      "AI operation completed successfully"
    );

    return aiSuccess(result.output as T, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, code }, "AI operation failed");

    return aiError(message, code);
  }
}

/**
 * Execute an AI operation with text input only.
 * Convenience wrapper around execute() for non-vision requests.
 */
export async function executeText<T>(
  schema: ZodSchema<T>,
  prompt: string,
  systemMessage: string,
  overrides?: { temperature?: number; maxTokens?: number }
): Promise<AIResult<T>> {
  return execute({
    schema,
    prompt,
    systemMessage,
    ...overrides,
  });
}

/**
 * Execute an AI operation with image input.
 * Convenience wrapper around execute() for vision requests.
 */
export async function executeVision<T>(
  schema: ZodSchema<T>,
  prompt: string,
  systemMessage: string,
  images: ImageContent[],
  overrides?: { temperature?: number; maxTokens?: number }
): Promise<AIResult<T>> {
  return execute({
    schema,
    prompt,
    systemMessage,
    useVisionModel: true,
    images,
    ...overrides,
  });
}
