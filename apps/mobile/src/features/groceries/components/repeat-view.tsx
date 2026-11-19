import React from "react";
import { Text, View } from "react-native";
import { Segmented } from "@/components/segmented";
import { SheetBody } from "@/components/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";
import {
  formatNextOccurrence,
  recurrenceTranslationsFrom,
  recurrenceUnitKey,
} from "@norish/shared/lib/recurrence/formatter";
import {
  recurrenceHasWeekday,
  stepRecurrenceInterval,
  withRecurrenceRule,
} from "@norish/shared/lib/recurrence/pattern";

import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { FieldLabel } from "./form-parts";

const RULES = [
  ["day", "daily"],
  ["week", "weekly"],
  ["month", "monthly"],
  ["year", "yearly"],
] as const satisfies readonly (readonly [RecurrenceRule, string])[];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** The body of Repeat: frequency, interval, weekday and what it will read as. */
export function RepeatBody({
  pattern,
  onChange,
}: {
  pattern: RecurrencePattern | null;
  onChange: (pattern: RecurrencePattern) => void;
}) {
  const intl = useIntl();
  const label = useRecurrenceLabel();
  const [foreground, accentText] = useThemeColor(["foreground", "accent"] as const);
  const text = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: `common.recurrence.${key}` }, values);
  const next = pattern ? calculateNextOccurrence(pattern, getTodayString()) : null;
  const words = recurrenceTranslationsFrom(text);

  return (
    <SheetBody contentClassName="gap-2">
      <FieldLabel>{text("frequency")}</FieldLabel>
      <Segmented
        segments={RULES.map(([rule, key]) => ({
          value: rule,
          label: text(key),
          testID: `repeat-frequency-${rule}`,
        }))}
        testID="repeat-frequency"
        value={pattern?.rule ?? null}
        onChange={(rule) => onChange(withRecurrenceRule(pattern, rule))}
      />
      {pattern ? (
        <>
          <View className="pt-2.5">
            <FieldLabel>{text("interval")}</FieldLabel>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Button
              isIconOnly
              accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.decreaseInterval" })}
              className="bg-sand size-11 rounded-full"
              isDisabled={pattern.interval <= 1}
              testID="repeat-interval-decrease"
              variant="secondary"
              onPress={() => onChange(stepRecurrenceInterval(pattern, -1))}
            >
              <Ionicons color={foreground} name="remove" size={16} />
            </Button>
            <View className="bg-sand h-11 flex-1 flex-row items-baseline justify-center gap-1.5 rounded-full pt-2">
              <Text className="text-foreground text-[22px] font-bold" testID="repeat-interval">
                {pattern.interval}
              </Text>
              <Text className="text-muted text-[13px]">{text(recurrenceUnitKey(pattern))}</Text>
            </View>
            <Button
              isIconOnly
              accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.increaseInterval" })}
              className="bg-sand size-11 rounded-full"
              testID="repeat-interval-increase"
              variant="secondary"
              onPress={() => onChange(stepRecurrenceInterval(pattern, 1))}
            >
              <Ionicons color={foreground} name="add" size={16} />
            </Button>
          </View>
        </>
      ) : null}
      {recurrenceHasWeekday(pattern) && pattern ? (
        <>
          <View className="pt-2.5">
            <FieldLabel>{text("onDay")}</FieldLabel>
          </View>
          <Segmented
            size="compact"
            segments={WEEKDAYS.map((key, index) => ({
              value: String(index),
              label: text(`weekdays.${key}`),
              testID: `repeat-weekday-${index}`,
            }))}
            testID="repeat-weekday"
            value={String(pattern.weekday ?? 1)}
            onChange={(day) => onChange({ ...pattern, weekday: Number(day) })}
          />
        </>
      ) : null}
      {pattern ? (
        <View className="bg-sand mt-2.5 gap-2 rounded-[18px] px-3.5 py-3" testID="repeat-preview">
          <View className="flex-row items-center gap-2.5">
            <Ionicons color={accentText} name="calendar-outline" size={16} />
            <Text className="text-foreground flex-1 text-sm font-semibold">{label(pattern)}</Text>
          </View>
          {next ? (
            <View className="bg-sand ml-[26px] flex-row gap-1 self-start rounded-full px-3 py-1.5">
              <Text className="text-muted text-[13px]">{text("next")}</Text>
              <Text className="text-foreground text-[13px] font-medium">
                {formatNextOccurrence(next, words)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </SheetBody>
  );
}
