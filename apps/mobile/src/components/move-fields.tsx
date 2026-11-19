import React from "react";
import { View } from "react-native";
import { useSlotSegments } from "@/lib/slot-segments";

import type { Slot } from "@norish/shared/contracts";

import { DayStrip } from "./day-strip";
import { Segmented } from "./segmented";

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
  /** The picked day's date key. */
  date: string;
  slot: Slot;
  /** The prefix of every control's testID. */
  testID: string;
  days?: boolean;
  onDateChange: (day: string, fromChip: boolean) => void;
  onSlotChange: (slot: Slot) => void;
}) {
  const segments = useSlotSegments(`${testID}-slot`);

  return (
    <View className="gap-3">
      {days ? <DayStrip date={date} testID={testID} onChange={onDateChange} /> : null}
      <Segmented
        segments={segments}
        testID={`${testID}-slot`}
        value={slot}
        onChange={onSlotChange}
      />
    </View>
  );
}
