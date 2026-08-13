"use client";

import { createDevicePreferenceContext } from "@/context/device-preference-context";
import { amountDisplayPreference } from "@/lib/amount-display";

/**
 * Mounted in the app shell and in the share route's layout — the two
 * surfaces that render ingredient amounts — each seeding from its own
 * server pass; the offline bootstrap mounts the shell unseeded and the
 * provider reads the cookie itself.
 */
const { Provider: AmountDisplayProvider, usePreference: useAmountDisplayMode } =
  createDevicePreferenceContext(amountDisplayPreference, "AmountDisplay");

export { AmountDisplayProvider, useAmountDisplayMode };
