/**
 * AI Prompts module.
 *
 * Prompt builders for AI operations. The templates themselves live in
 * `@norish/shared-server/ai/prompts`, which is the only directory the loader
 * resolves — this module builds prompts, it does not store them.
 */

// Core prompt loading and filling
export {
  loadPrompt,
  loadDefaultPrompts,
  fillPrompt,
} from "@norish/shared-server/ai/prompts/loader";

// Prompt builders for specific extraction types
export {
  buildRecipeExtractionPrompt,
  buildImageExtractionPrompt,
  buildVideoExtractionPrompt,
  type RecipeExtractionPromptOptions,
  type VideoExtractionPromptOptions,
} from "./builder";
