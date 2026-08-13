"use client";

import { useUserContext } from "@/context/user-context";

import type { HiddenItem } from "@norish/shared/contracts/zod/user";
import { isHiddenForUser } from "@norish/shared/lib/user-preferences";

export type UseHiddenItemVisibilityResult = {
  showRatings: boolean;
  showFavorites: boolean;
  showConversion: boolean;
};

/**
 * The reader's Hidden Item choices as visibility flags, derived in one place
 * so every consumer answers "is this shown for this reader?" the same way.
 */
export function useHiddenItemVisibility(): UseHiddenItemVisibilityResult {
  const { user } = useUserContext();
  const shows = (item: HiddenItem) => !isHiddenForUser(user, item);

  return {
    showRatings: shows("rating"),
    showFavorites: shows("favorites"),
    showConversion: shows("conversion"),
  };
}
