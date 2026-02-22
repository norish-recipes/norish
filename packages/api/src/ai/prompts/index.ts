/**
 * AI Prompts module.
 *
 * Provides prompt templates, fragments, and builders for AI operations.
 */

// Core prompt loading and filling
export { loadPrompt, loadDefaultPrompts, fillPrompt } from "./loader";

// Prompt builders for specific extraction types
export {
  buildRecipeExtractionPrompt,
  buildImageExtractionPrompt,
  buildVideoExtractionPrompt,
  type RecipeExtractionPromptOptions,
  type VideoExtractionPromptOptions,
} from "./builder";

// Reusable prompt fragments
export { buildAllergyInstruction, type AllergyInstructionOptions } from "./fragments/allergies";
