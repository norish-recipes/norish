"use client";

import { useCallback } from "react";
import { useAmountDisplayMode } from "@/context/amount-display-context";

import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";

/**
 * The shared hook's interface over the web's cookie binding: every consumer
 * — the readonly ingredients list, the per-step rows, the toggle — is
 * untouched, only the storage underneath changed. Mobile keeps the shared
 * factory over its own native binding.
 */
export function useAmountDisplayPreference(): {
  mode: AmountDisplayMode;
  setMode: (mode: AmountDisplayMode) => void;
  toggleMode: () => void;
} {
  const [mode, setMode] = useAmountDisplayMode();

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "decimal" ? "fraction" : "decimal"));
  }, [setMode]);

  return { mode, setMode, toggleMode };
}
