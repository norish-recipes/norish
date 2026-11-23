import type { MeasurementSystemChoice } from "@norish/shared/lib/user-preferences";
import { HIDDEN_ITEMS, partitionHiddenItems } from "@norish/shared-react/reader";
import { MEASUREMENT_SYSTEM_CHOICES } from "@norish/shared/contracts/zod/user";
import { measurementSystemTarget } from "@norish/shared/lib/user-preferences";

type HiddenItem = (typeof HIDDEN_ITEMS)[number];

/** Converting with AI is on offer only where an administrator has AI on. */
export const measurementChoices = (aiEnabled: boolean): readonly MeasurementSystemChoice[] =>
  aiEnabled
    ? MEASUREMENT_SYSTEM_CHOICES
    : MEASUREMENT_SYSTEM_CHOICES.filter((choice) => !choice.endsWith("WithAI"));

/** A choice of AI made before it was switched off reads as the same system without. */
export const shownMeasurement = (
  stored: MeasurementSystemChoice,
  aiEnabled: boolean
): MeasurementSystemChoice =>
  aiEnabled ? stored : (measurementSystemTarget(stored)?.system ?? "off");

/** Timers can be switched off for the whole deployment, which leaves nothing to offer. */
export const offeredHiddenItems = (timersEnabled: boolean): readonly HiddenItem[] =>
  timersEnabled ? HIDDEN_ITEMS : HIDDEN_ITEMS.filter((item) => item !== "timers");

/** The stored list with `item` flipped; a stored name that is not on offer is carried through. */
export function toggledHiddenItems(
  stored: readonly string[],
  offered: readonly HiddenItem[],
  item: HiddenItem
) {
  const { selected, carried } = partitionHiddenItems(stored, offered);
  const next = selected.includes(item)
    ? selected.filter((chosen) => chosen !== item)
    : [...selected, item];

  return [...offered.filter((offer) => next.includes(offer)), ...carried];
}
