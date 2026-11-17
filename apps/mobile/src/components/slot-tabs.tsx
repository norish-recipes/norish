import React from "react";
import { Tabs } from "heroui-native";
import { useIntl } from "react-intl";

import type { Slot } from "@norish/shared/contracts";
import { slotTranslationKeys, TODAY_MEAL_SLOTS } from "@norish/shared-react/calendar/todays-meals";

/** A meal slot from a tab's value, Dinner for anything else. */
export const asSlot = (value: string | undefined): Slot =>
  TODAY_MEAL_SLOTS.find((slot) => slot === value) ?? "Dinner";

/** The four meal slots as one rounded segmented control; each tab's testID is `${testID}-${slot}`. */
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
    <Tabs value={value} onValueChange={(next) => onChange(asSlot(next))}>
      <Tabs.List className="bg-default h-10 rounded-full p-[3px]">
        <Tabs.Indicator className="bg-surface rounded-full" />
        {TODAY_MEAL_SLOTS.map((slot) => (
          <Tabs.Trigger
            key={slot}
            className="h-[34px] flex-1 px-0"
            testID={`${testID}-${slot}`}
            value={slot}
          >
            <Tabs.Label className="text-sm font-medium" numberOfLines={1}>
              {intl.formatMessage({ id: `common.slots.${slotTranslationKeys[slot]}` })}
            </Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
