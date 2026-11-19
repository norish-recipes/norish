import React from "react";
import { Text, View } from "react-native";
import { Segmented } from "@/components/segmented";
import { SheetBody } from "@/components/sheet";
import { Stepper } from "@/components/stepper";
import { useIntl } from "react-intl";

import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";
import {
  formatNextOccurrence,
  recurrenceTranslationsFrom,
} from "@norish/shared/lib/recurrence/formatter";
import {
  recurrenceHasWeekday,
  stepRecurrenceInterval,
  withRecurrenceRule,
} from "@norish/shared/lib/recurrence/pattern";

import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { FieldLabel } from "./form-parts";

const RULES = [
  ["day", "daily", "everyDay"],
  ["week", "weekly", "everyWeek"],
  ["month", "monthly", "everyMonth"],
  ["year", "yearly", "everyYear"],
] as const satisfies readonly (readonly [RecurrenceRule, string, string])[];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const everyKey = (rule: RecurrenceRule) =>
  RULES.find(([candidate]) => candidate === rule)?.[2] ?? "everyWeek";

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
          <Stepper
            wide
            canDecrement={pattern.interval > 1}
            decreaseLabel={intl.formatMessage({ id: "groceries.mobile.decreaseInterval" })}
            increaseLabel={intl.formatMessage({ id: "groceries.mobile.increaseInterval" })}
            testID="repeat-interval"
            onDecrement={() => onChange(stepRecurrenceInterval(pattern, -1))}
            onIncrement={() => onChange(stepRecurrenceInterval(pattern, 1))}
          >
            <Text className="text-foreground text-[15px] font-semibold" testID="repeat-interval">
              {text(everyKey(pattern.rule), { interval: pattern.interval })}
            </Text>
          </Stepper>
        </>
      ) : null}
      {recurrenceHasWeekday(pattern) && pattern ? (
        <>
          <View className="pt-2.5">
            <FieldLabel>{text("onDay")}</FieldLabel>
          </View>
          <Segmented
            segments={WEEKDAYS.map((key, index) => ({
              value: String(index),
              label: text(`weekdays.${key}`),
              testID: `repeat-weekday-${index}`,
            }))}
            size="compact"
            testID="repeat-weekday"
            value={String(pattern.weekday ?? 1)}
            onChange={(day) => onChange({ ...pattern, weekday: Number(day) })}
          />
        </>
      ) : null}
      {pattern ? (
        <Text className="text-muted px-2 pt-2.5 text-[15px]" testID="repeat-preview">
          {next
            ? `${label(pattern)} · ${text("next")} ${formatNextOccurrence(next, words)}`
            : label(pattern)}
        </Text>
      ) : null}
    </SheetBody>
  );
}
