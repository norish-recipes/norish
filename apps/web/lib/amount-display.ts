import { defineDevicePreference } from "@/lib/device-preferences";

import type { AmountDisplayMode } from "@norish/shared/lib/format-amount";

/**
 * Fraction-or-decimal amounts ride a device-preference cookie so a recipe
 * page arrives already in the reader's format — a decimal reader never
 * watches ½ and ¾ paint and flip. Mobile keeps its own native binding.
 */
export const amountDisplayPreference = defineDevicePreference({
  cookieName: "norish_amount_display",
  values: ["fraction", "decimal"] as const satisfies readonly AmountDisplayMode[],
  defaultValue: "fraction",
});
