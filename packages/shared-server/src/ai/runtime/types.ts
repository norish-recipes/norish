/**
 * AI Provider - Shared types for provider modules.
 */

import type { LanguageModel } from "ai";

import type { AIConfig } from "@norish/config/zod/server-config";

/**
 * Model configuration returned by factory functions.
 */
export interface ModelConfig {
  /** Primary text model */
  model: LanguageModel;
  /** Vision-capable model for image processing */
  visionModel: LanguageModel;
  /** Provider name for logging */
  providerName: string;
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
 * Provider type from AI config schema.
 */
export type AIProvider = AIConfig["provider"];
