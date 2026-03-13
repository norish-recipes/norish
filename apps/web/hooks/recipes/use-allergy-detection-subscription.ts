"use client";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

/**
 * Hook for allergy detection functionality.
 * Provides subscriptions for status updates.
 */
export const useAllergyDetection = sharedRecipeFamilyHooks.useAllergyDetection;

/**
 * Hook for triggering allergy detection mutation.
 */
export const useAllergyDetectionMutation = sharedRecipeFamilyHooks.useAllergyDetectionMutation;
