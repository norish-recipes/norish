import React from "react";
import { GlassSegmented } from "@/components/glass-segmented";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { slotTranslationKeys, TODAY_MEAL_SLOTS } from "@norish/shared-react/calendar/todays-meals";

/** A meal slot from a tab's value, Dinner for anything else. */
export const asSlot = (value: string | undefined): Slot =>
  TODAY_MEAL_SLOTS.find((slot) => slot === value) ?? "Dinner";

/** The four meal slots as one glass segmented control; each tab's testID is `${testID}-${slot}`. */
export function SlotTabs({
  value,
  testID,
  onChange,
}: {
  value: Slot;
  testID: string;
  onChange: (slot: Slot) => void;
}) {
  const intl = useIntl();

  return (
    <GlassSegmented
      segments={TODAY_MEAL_SLOTS.map((slot) => ({
        value: slot,
        label: intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` }),
        testID: `${testID}-${slot}`,
      }))}
      testID={testID}
      value={value}
      onChange={onChange}
    />
  );
}
