import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";

import { useDevicePreference } from "../reader";

/** Decimal or fraction amounts, read and toggled through the `amountDisplay` Device Preference. */
export function useAmountDisplayPreference(): {
  mode: AmountDisplayMode;
  setMode: (mode: AmountDisplayMode) => void;
  toggleMode: () => void;
} {
  const [mode, setMode] = useDevicePreference("amountDisplay");

  const toggleMode = () => setMode((prev) => (prev === "decimal" ? "fraction" : "decimal"));

  return { mode, setMode, toggleMode };
}
