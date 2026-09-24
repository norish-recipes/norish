/**
 * The queues, by name. A leaf on purpose: `config.ts` builds workers on top of
 * these and `job-steps.ts` declares each queue's pipeline against them, and
 * the worker manager wraps every processor with the step reporting's model
 * ledger, so neither of those may import the other. `config.ts` re-exports
 * both names so every existing `@norish/queue/config` import still holds.
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
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
