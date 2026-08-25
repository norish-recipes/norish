"use client";

import type { HiddenItem } from "@/lib/hidden-items";
import { useHiddenItems } from "@/context/hidden-items-context";

export type UseHiddenItemVisibilityResult = {
  showRatings: boolean;
  showFavorites: boolean;
  showConversion: boolean;
  showProvenance: boolean;
  showNutrition: boolean;
  showNotes: boolean;
  showCookbooks: boolean;
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
    // The recipe page's cookbooks card only. Hiding it never touches the
    // Library or its type chips.
    showCookbooks: shows("cookbooks"),
  };
}
