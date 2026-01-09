/**
 * AI Module - Central exports.
 *
 * This is the main entry point for all AI functionality.
 * Import from here for cleaner imports throughout the codebase.
 *
 * @example
 * ```ts
 * import {
 *   // Core execution
 *   execute,
 *   executeText,
 *   executeVision,
 *
 *   // Guards
 *   isAIEnabled,
 *   requireAI,
 *
 *   // Result types
 *   aiSuccess,
 *   aiError,
 *   type AIResult,
 *
 *   // Feature functions
 *   extractRecipeWithAI,
 *   extractRecipeFromImages,
 *   convertRecipeDataWithAI,
 *   estimateNutritionFromIngredients,
 * } from "@/server/ai";
 * ```
 */

// ============================================================================
// Core - Executor, guards, and types
// ============================================================================

export { execute, executeText, executeVision } from "./core/executor";
export { isAIEnabled, requireAI, requireAIOrThrow } from "./core/guards";
export {
  aiSuccess,
  aiError,
  mapErrorToCode,
  getErrorMessage,
  type AIResult,
  type AIErrorCode,
  type ExecuteOptions,
  type ImageContent,
  type TokenUsage,
} from "./core/types";

// ============================================================================
// Providers - Model creation and listing
// ============================================================================

export {
  getModels,
  createModelsFromConfig,
  getGenerationSettings,
  listModels,
  listOllamaModels,
  listOpenAICompatibleModels,
  listTranscriptionModels,
  type ModelConfig,
  type GenerationSettings,
  type ModelCapabilities,
  type AvailableModel,
  type AIProvider,
} from "./providers";

// ============================================================================
// Prompts - Template loading and building
// ============================================================================

export {
  loadPrompt,
  loadDefaultPrompts,
  fillPrompt,
  buildRecipeExtractionPrompt,
  buildImageExtractionPrompt,
  buildVideoExtractionPrompt,
  buildAllergyInstruction,
  type RecipeExtractionPromptOptions,
  type VideoExtractionPromptOptions,
  type AllergyInstructionOptions,
} from "./prompts";

// ============================================================================
// Features - High-level AI operations
// ============================================================================

// Recipe extraction (HTML, images, video)
export { extractRecipeWithAI } from "./recipe-parser";
export type { RecipeExtractionOutput } from "./recipe-parser";

export { extractRecipeFromImages } from "./image-recipe-parser";

// Recipe extraction normalization utilities
export {
  normalizeExtractionOutput,
  validateExtractionOutput,
  getExtractionLogContext,
  type NormalizeExtractionOptions,
  type ValidationResult,
} from "./features/recipe-extraction";

// Unit conversion
export { convertRecipeDataWithAI, type ConversionResult } from "./unit-converter";
export type { ConversionOutput } from "./unit-converter";

// Nutrition estimation
export {
  estimateNutritionFromIngredients,
  type IngredientForEstimation,
} from "./nutrition-estimator";
export type { NutritionEstimate } from "./nutrition-estimator";

// Auto-tagging
export { generateTagsForRecipe, type RecipeForTagging } from "./auto-tagger";
export type { AutoTaggingOutput } from "./auto-tagger";

// Allergy detection
export { detectAllergiesInRecipe, type RecipeForAllergyDetection } from "./allergy-detector";
export type { AllergyDetectionOutput } from "./allergy-detector";

// Transcription
export { transcribeAudio } from "./transcriber";

// ============================================================================
// Schemas - Zod schemas for AI outputs
// ============================================================================

export { recipeExtractionSchema } from "./schemas/recipe.schema";
export { nutritionEstimationSchema } from "./schemas/nutrition.schema";
export { conversionSchema } from "./schemas/conversion.schema";
export { autoTaggingSchema } from "./schemas/auto-tagging.schema";

// ============================================================================
// Helpers - Utility functions
// ============================================================================

export {
  extractSanitizedBody,
  extractImageCandidates,
  normalizeIngredient,
  normalizeStep,
} from "./helpers";
