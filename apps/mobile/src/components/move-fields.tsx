import React from "react";
import { View } from "react-native";

import type { Slot } from "@norish/shared/contracts";

import { DayStrip } from "./day-strip";
import { SlotTabs } from "./slot-tabs";

/** Where a planned item goes: the day strip with its date picker, then the slot tabs. `days`
 * false leaves the strip out, for a sheet opened on one day. */
export function MoveFields({
  date,
  slot,
  testID,
  days = true,
  onDateChange,
  onSlotChange,
}: {
  date: Date;
  slot: Slot;
  /** The prefix of every control's testID. */
  testID: string;
  days?: boolean;
  onDateChange: (day: Date, fromChip: boolean) => void;
  onSlotChange: (slot: Slot) => void;
}) {
  return (
    <View className="gap-3">
      {days ? <DayStrip date={date} testID={testID} onChange={onDateChange} /> : null}
      <SlotTabs testID={`${testID}-slot`} value={slot} onChange={onSlotChange} />
    </View>
  );
}
