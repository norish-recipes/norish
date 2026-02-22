/**
 * AI Recipe Extraction feature module.
 *
 * Provides shared utilities for extracting recipes from various sources
 * (HTML, images, video transcripts) using AI.
 */

export {
  normalizeExtractionOutput,
  validateExtractionOutput,
  getExtractionLogContext,
  type NormalizeExtractionOptions,
  type ValidationResult,
} from "./normalizer";
