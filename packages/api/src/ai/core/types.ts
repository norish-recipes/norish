/**
 * Core types for the AI module.
 *
 * This file contains shared types used across all AI features.
 * Provider types are re-exported from providers/types.ts to avoid duplication.
 */

import type { ZodSchema } from "zod";

// Re-export result types from existing module for backwards compatibility
export {
  aiSuccess,
  aiError,
  mapErrorToCode,
  getErrorMessage,
  type AIResult,
  type AIErrorCode,
  type TokenUsage,
} from "../types/result";

// Re-export provider types to avoid duplication
export type {
  ModelConfig,
  GenerationSettings,
  ModelCapabilities,
  AvailableModel,
} from "../providers/types";

/**
 * Content types for multimodal inputs.
 */
export interface ImageContent {
  /** Base64-encoded image data */
  data: string;
  /** MIME type of the image */
  mimeType: string;
  /** Optional filename for logging */
  filename?: string;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image";
  image: string;
  mediaType: string;
}

export type MessageContent = TextContent | ImageContentPart;

/**
 * Options for executing an AI operation.
 */
export interface ExecuteOptions<T> {
  /** Zod schema for structured output validation */
  schema: ZodSchema<T>;
  /** The prompt to send to the AI */
  prompt: string;
  /** System message for the AI */
  systemMessage: string;
  /** Whether to use the vision-capable model */
  useVisionModel?: boolean;
  /** Images to include (requires useVisionModel: true) */
  images?: ImageContent[];
  /** Override temperature for this request */
  temperature?: number;
  /** Override max tokens for this request */
  maxTokens?: number;
}

/**
 * Result of executing an AI operation with usage stats.
 */
export interface ExecuteResult<T> {
  /** The parsed output from the AI */
  output: T;
  /** Token usage statistics */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}
