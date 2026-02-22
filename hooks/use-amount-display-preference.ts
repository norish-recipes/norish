"use client";

import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";

import { useCallback } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";

const STORAGE_KEY = "norish:amount-display-mode";
const DEFAULT_MODE: AmountDisplayMode = "fraction";

/**
 * Validate stored mode value.
 */
function validateMode(data: unknown): AmountDisplayMode | null {
  return data === "decimal" || data === "fraction" ? data : null;
}

/**
 * Hook for managing the user's preferred amount display mode (decimal or fraction).
 * Persists preference to localStorage and syncs across components.
 *
 * @returns Object with:
 *   - mode: Current display mode ("decimal" or "fraction")
 *   - setMode: Function to update the mode
 *   - toggleMode: Function to toggle between modes
 */
export function useAmountDisplayPreference(): {
  mode: AmountDisplayMode;
  setMode: (mode: AmountDisplayMode) => void;
  toggleMode: () => void;
} {
  const [mode, setModeInternal] = useLocalStorage<AmountDisplayMode>(
    STORAGE_KEY,
    DEFAULT_MODE,
    validateMode
  );

  const setMode = useCallback(
    (newMode: AmountDisplayMode) => {
      setModeInternal(newMode);
    },
    [setModeInternal]
  );

  const toggleMode = useCallback(() => {
    setModeInternal((prev) => (prev === "decimal" ? "fraction" : "decimal"));
  }, [setModeInternal]);

  return {
    mode,
    setMode,
    toggleMode,
  };
}
