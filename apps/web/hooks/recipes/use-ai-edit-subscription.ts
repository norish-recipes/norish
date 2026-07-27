"use client";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

/**
 * Hook for AI recipe editing.
 * Subscribes to started/completed status updates for the loading state.
 */
export const useAiEdit = sharedRecipeFamilyHooks.useAiEdit;

/**
 * Hook for triggering the AI recipe edit mutation.
 */
export const useAiEditMutation = sharedRecipeFamilyHooks.useAiEditMutation;
