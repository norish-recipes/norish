"use client";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

/**
 * Hook for auto-tagging functionality.
 * Provides mutation to trigger auto-tagging and subscriptions for status updates.
 */
export const useAutoTagging = sharedRecipeFamilyHooks.useAutoTagging;

/**
 * Hook for triggering auto-tagging mutation.
 */
export const useAutoTaggingMutation = sharedRecipeFamilyHooks.useAutoTaggingMutation;
