"use client";

import type { DevicePreferenceState } from "@/context/device-preference-context";
import { createDevicePreferenceContext } from "@/context/device-preference-context";
import { hiddenItemsPreference } from "@/lib/hidden-items";

/**
 * The hidden list governing this render, known from the very first frame.
 *
 * Every consumer of Hidden Items reads this context, so nothing hideable can
 * render before the list is known. The list is a device preference on the
 * `norish_hidden_items` cookie (ticket 23), so the three load paths are the
 * same as every other device preference: a server-rendered request seeds the
 * provider from the cookie it carried, while the offline bootstrap and a
 * navigation answered by the service worker's cached HTML self-read the
 * cookie on the device — no network on any path.
 */
const { Provider, usePreference } = createDevicePreferenceContext(
  hiddenItemsPreference,
  "HiddenItemsContext"
);

export function HiddenItemsProvider({
  initialHiddenItems,
  children,
}: {
  /** The list as the layout's server pass read the cookie; absent offline. */
  initialHiddenItems?: readonly string[];
  children: React.ReactNode;
}) {
  return <Provider initialValue={initialHiddenItems}>{children}</Provider>;
}

/** The list plus its setter — the settings control's read/write pair. */
export function useHiddenItemsState(): DevicePreferenceState<readonly string[]> {
  return usePreference();
}

export function useHiddenItems(): readonly string[] {
  return usePreference()[0];
}
