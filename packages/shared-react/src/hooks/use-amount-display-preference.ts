import { useCallback } from "react";

import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";

const DEFAULT_MODE: AmountDisplayMode = "fraction";

type CreateUseAmountDisplayPreferenceOptions = {
  useStorage: <T>(
    key: string,
    defaultValue: T,
    validate?: (data: unknown) => T | null
  ) => [T, (updater: T | ((prev: T) => T)) => void];
};

function validateMode(data: unknown): AmountDisplayMode | null {
  return data === "decimal" || data === "fraction" ? data : null;
}

export function createUseAmountDisplayPreference({
  useStorage,
}: CreateUseAmountDisplayPreferenceOptions) {
  return function useAmountDisplayPreference(): {
    mode: AmountDisplayMode;
    setMode: (mode: AmountDisplayMode) => void;
    toggleMode: () => void;
  } {
    const [mode, setModeInternal] = useStorage<AmountDisplayMode>(
      "norish:amount-display-mode",
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
  };
}
