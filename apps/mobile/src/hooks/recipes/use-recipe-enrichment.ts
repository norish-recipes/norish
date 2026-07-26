import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

/**
 * Recipe Enrichment lifecycle and manual requests for all four kinds.
 * Replaces the separate auto-tagging, allergy, categorization, and nutrition hooks.
 */
export const useRecipeEnrichment = sharedRecipeFamilyHooks.useRecipeEnrichment;
