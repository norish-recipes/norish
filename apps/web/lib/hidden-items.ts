import { defineDeviceListPreference } from "@/lib/device-preferences";

/**
 * The things a reader can choose not to be shown. Names only — what each one
 * suppresses is the reading side's business.
 *
 * `timers` differs from the rest in one way: an administrator can switch recipe
 * timers off for the whole deployment, and when they have, a reader is never
 * offered the choice. The stored name survives that, so turning the capability
 * back on restores whatever the reader had chosen.
 */
export const HIDDEN_ITEMS = [
  "provenance",
  "nutrition",
  "notes",
  "rating",
  "favorites",
  "conversion",
  "timers",
] as const;

export type HiddenItem = (typeof HIDDEN_ITEMS)[number];

/**
 * The hidden list is a device preference like every other visibility choice
 * (ticket 23): screen space is a property of the device, so each device keeps
 * its own list. Absent or empty means everything is shown. The list parse
 * keeps entries it does not recognise, which is what lets the settings
 * control carry a choice it cannot currently offer.
 */
export const hiddenItemsPreference = defineDeviceListPreference({
  cookieName: "norish_hidden_items",
});

/**
 * A stored list split into what a control can show and what it must carry.
 *
 * `selected` is what the control ticks, in contract order. `carried` is
 * everything else stored: a name from a newer version this one cannot offer,
 * or one an administrator has gated off. A control writes back
 * `[...chosen, ...carried]`, so it can never drop a choice it was not in a
 * position to show.
 */
export function partitionHiddenItems(
  stored: readonly string[],
  offered: readonly HiddenItem[] = HIDDEN_ITEMS
): { selected: HiddenItem[]; carried: string[] } {
  const offeredNames = new Set<string>(offered);

  return {
    selected: offered.filter((item) => stored.includes(item)),
    carried: stored.filter((item) => !offeredNames.has(item)),
  };
}
