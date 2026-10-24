/**
 * The queues, by name. A leaf on purpose: `job-steps.ts` declares each
 * queue's pipeline against them, and `create-worker.ts` wraps every processor
 * with the step reporting's model ledger, so neither may reach the other
 * through this module.
 */
export const QUEUE_NAMES = {
  RECIPE_IMPORT: "recipe-import",
  IMAGE_IMPORT: "image-recipe-import",
  PASTE_IMPORT: "paste-recipe-import",
  CALDAV_SYNC: "caldav-sync",
  SCHEDULED_TASKS: "scheduled-tasks",
  NUTRITION_ESTIMATION: "nutrition-estimation",
  AUTO_TAGGING: "auto-tagging",
  AUTO_CATEGORIZATION: "auto-categorization",
  ALLERGY_DETECTION: "allergy-detection",
  RECIPE_PROVENANCE: "recipe-provenance",
  INGREDIENT_LINKING: "ingredient-linking",
  IMAGE_GENERATION: "image-generation",
  STORE_LOOKUP: "store-lookup",
  INGREDIENT_REVIEW: "ingredient-review",
  INGREDIENT_ICONS: "ingredient-icons",
  INGREDIENT_FILL: "ingredient-fill",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
