import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import { stripDays } from "@/lib/strip-days";
import { DatePicker, Host } from "@expo/ui/swift-ui";
import { accessibilityIdentifier, tint } from "@expo/ui/swift-ui/modifiers";
import { useIntl } from "react-intl";

import { useToday } from "@norish/shared-react/reader";
import { dateKey, parseDateKey } from "@norish/shared/lib/helpers";

import { SheetStrip } from "./sheet";

/** A chip's width and the gap after it: drawn with these and read back for the opening offset. */
const CHIP = 52;
const GAP = 8;

/** The days from today as chips, then the date picker for any other day; `onChange` says which
 * of the two picked. Each chip's testID is `${testID}-day-${offset}`, the picker's `${testID}-other-day`. */
export function DayStrip({
  date,
  testID,
  onChange,
}: {
  /** The picked day's date key. */
  date: string;
  testID: string;
  onChange: (day: string, fromChip: boolean) => void;
}) {
  const intl = useIntl();
  const accentText = useAccentTextColor();
  const days = stripDays(useToday());
  // Opens with the picked day in view, not scrolled back to today.
  const [start] = useState(() => Math.max(0, days.indexOf(date) * (CHIP + GAP) - CHIP));

  return (
    // heroui-native has no day strip, so these chips are hand-built.
    <SheetStrip
      accessibilityLabel={intl.formatMessage({ id: "calendar.panel.addToCalendar" })}
      contentOffset={{ x: start, y: 0 }}
      testID={`${testID}-days`}
    >
      {days.map((key, offset) => {
        const day = parseDateKey(key);
        const selected = key === date;
        const label =
          offset === 0
            ? intl.formatMessage({ id: "calendar.mobile.today" })
            : intl.formatDate(day, { weekday: "short" });

        return (
          <Pressable
            key={key}
            accessibilityLabel={intl.formatDate(day, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            className={`h-16 items-center justify-center gap-0.5 rounded-[18px] ${selected ? "bg-accent" : "bg-default"}`}
            style={{ width: CHIP, marginRight: GAP }}
            testID={`${testID}-day-${offset}`}
            onPress={() => onChange(key, true)}
          >
            <Text
              className={`text-xs font-medium ${selected ? "text-accent-foreground" : "text-foreground"}`}
            >
              {label}
            </Text>
            <Text
              className={`text-[19px] font-semibold ${selected ? "text-accent-foreground" : "text-foreground"}`}
            >
              {day.getDate()}
            </Text>
          </Pressable>
        );
      })}
      <View className="h-16 justify-center">
        <Host matchContents>
          <DatePicker
            modifiers={[
              accessibilityIdentifier(`${testID}-other-day`),
              ...(accentText ? [tint(accentText)] : []),
            ]}
            selection={parseDateKey(date)}
            onDateChange={(next) => onChange(dateKey(next), false)}
          />
        </Host>
      </View>
    </SheetStrip>
  );
}
