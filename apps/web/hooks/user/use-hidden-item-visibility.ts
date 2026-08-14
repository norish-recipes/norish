"use client";

import { useHiddenItems } from "@/context/hidden-items-context";

import type { HiddenItem } from "@norish/shared/contracts/zod/user";

export type UseHiddenItemVisibilityResult = {
  showRatings: boolean;
  showFavorites: boolean;
  showConversion: boolean;
  showProvenance: boolean;
  showNutrition: boolean;
  showNotes: boolean;
};

/**
 * The reader's Hidden Item choices as visibility flags, derived in one place
 * so every consumer answers "is this shown for this reader?" the same way.
 * Reads the seeded hidden list, so the answer is right from the first frame.
 */
export function useHiddenItemVisibility(): UseHiddenItemVisibilityResult {
  const hidden = useHiddenItems();
  const shows = (item: HiddenItem) => !hidden.includes(item);

  return {
    showRatings: shows("rating"),
    showFavorites: shows("favorites"),
    showConversion: shows("conversion"),
    showProvenance: shows("provenance"),
    showNutrition: shows("nutrition"),
    showNotes: shows("notes"),
  };
}
