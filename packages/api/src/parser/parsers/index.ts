/**
 * JSON-LD Recipe Parsers
 *
 * Modular parsers for extracting and normalizing different parts of
 * Schema.org Recipe structured data.
 */

export { extractNutrition, parseNutritionValue } from "./nutrition";
export type { ParsedNutrition } from "./nutrition";

export { parseSteps, collectSteps, deduplicateSteps } from "./steps";
export type { ParsedStep } from "./steps";

export { parseIngredients } from "./ingredients";
export type { ParsedIngredient, IngredientParseResult } from "./ingredients";

export { parseImages } from "./images";
export type { ParsedImage, ImageParseResult } from "./images";

export { parseVideos } from "./videos";
export type { ParsedVideo, VideoParseResult } from "./videos";

export { parseMetadata, getName, getServings } from "./metadata";
export type { ParsedMetadata } from "./metadata";
