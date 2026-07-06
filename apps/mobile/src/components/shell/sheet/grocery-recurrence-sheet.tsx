import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from "react-native-reanimated";
import { PanelButton } from "@/components/shell/panel-button";
import { ShellSheet } from "@/components/shell/sheet";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";
import type { RecurrenceTranslations } from "@norish/shared/lib/recurrence/formatter";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";
import {
  formatNextOccurrence,
  formatRecurrenceSummary,
} from "@norish/shared/lib/recurrence/formatter";

export type GroceryRecurrenceFrequency = "weekly" | "biweekly" | "monthly";

export type GroceryRecurrenceSettings = {
  enabled: boolean;
  frequency: GroceryRecurrenceFrequency;
  pattern: RecurrencePattern;
};

type GroceryRecurrenceSheetProps = {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
  value: GroceryRecurrenceSettings;
  onConfirm: (settings: GroceryRecurrenceSettings) => void;
};

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const RULE_OPTIONS: { id: RecurrenceRule; labelId: string; icon: string }[] = [
  { id: "day", labelId: "common.recurrence.daily", icon: "sunny-outline" },
  { id: "week", labelId: "common.recurrence.weekly", icon: "calendar-outline" },
  { id: "month", labelId: "common.recurrence.monthly", icon: "calendar-number-outline" },
];

export const DEFAULT_GROCERY_RECURRENCE_SETTINGS: GroceryRecurrenceSettings = {
  enabled: false,
  frequency: "weekly",
  pattern: { rule: "week", interval: 1, weekday: 1 },
};

function patternToFrequency(pattern: RecurrencePattern): GroceryRecurrenceFrequency {
  if (pattern.rule === "month") return "monthly";
  if (pattern.rule === "week" && pattern.interval === 2) return "biweekly";
  return "weekly";
}

export function GroceryRecurrenceSheet({
  isPresented,
  onIsPresentedChange,
  value,
  onConfirm,
}: GroceryRecurrenceSheetProps) {
  const intl = useIntl();
  const [enabled, setEnabled] = useState(value.enabled);
  const [pattern, setPattern] = useState<RecurrencePattern>(value.pattern);
  const [foregroundColor, mutedColor, surfaceColor, separatorColor, accentColor] = useThemeColor([
    "foreground",
    "muted",
    "surface-secondary",
    "separator",
    "accent",
  ] as const);

  React.useEffect(() => {
    if (isPresented) {
      setEnabled(true);
      setPattern(value.enabled ? value.pattern : DEFAULT_GROCERY_RECURRENCE_SETTINGS.pattern);
    }
  }, [isPresented, value.enabled, value.pattern]);

  const formatterTranslations: RecurrenceTranslations = {
    every: intl.formatMessage({ id: "common.recurrence.every" }),
    everyOther: intl.formatMessage({ id: "common.recurrence.everyOther" }),
    on: intl.formatMessage({ id: "common.recurrence.on" }),
    day: intl.formatMessage({ id: "common.recurrence.day" }),
    days: intl.formatMessage({ id: "common.recurrence.days" }),
    week: intl.formatMessage({ id: "common.recurrence.week" }),
    weeks: intl.formatMessage({ id: "common.recurrence.weeks" }),
    month: intl.formatMessage({ id: "common.recurrence.month" }),
    months: intl.formatMessage({ id: "common.recurrence.months" }),
    today: intl.formatMessage({ id: "common.recurrence.today" }),
    tomorrow: intl.formatMessage({ id: "common.recurrence.tomorrow" }),
    weekdaysFull: {
      "0": intl.formatMessage({ id: "common.recurrence.weekdaysFull.0" }),
      "1": intl.formatMessage({ id: "common.recurrence.weekdaysFull.1" }),
      "2": intl.formatMessage({ id: "common.recurrence.weekdaysFull.2" }),
      "3": intl.formatMessage({ id: "common.recurrence.weekdaysFull.3" }),
      "4": intl.formatMessage({ id: "common.recurrence.weekdaysFull.4" }),
      "5": intl.formatMessage({ id: "common.recurrence.weekdaysFull.5" }),
      "6": intl.formatMessage({ id: "common.recurrence.weekdaysFull.6" }),
    },
  };

  const handleConfirm = useCallback(() => {
    onConfirm({ enabled, frequency: patternToFrequency(pattern), pattern });
  }, [enabled, onConfirm, pattern]);

  const handleRuleChange = useCallback((rule: RecurrenceRule) => {
    setPattern((current) => ({
      rule,
      interval: current.interval,
      weekday: rule === "week" || rule === "month" ? (current.weekday ?? 1) : undefined,
    }));
  }, []);

  const handleIntervalChange = useCallback((delta: number) => {
    setPattern((current) => ({ ...current, interval: Math.max(1, current.interval + delta) }));
  }, []);

  const handleWeekdayChange = useCallback((weekday: number) => {
    setPattern((current) => ({ ...current, weekday }));
  }, []);

  const nextOccurrence = calculateNextOccurrence(pattern, getTodayString());
  const showWeekdaySelector = pattern.rule === "week" || pattern.rule === "month";

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={["medium", "large"]}
      initialDetent="large"
    >
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: foregroundColor }]}>
              {intl.formatMessage({ id: "groceries.panel.recurrenceSheet.title" })}
            </Text>
            <Text style={[styles.subtitle, { color: mutedColor }]}>
              {intl.formatMessage({ id: "groceries.panel.recurrenceSheet.subtitle" })}
            </Text>
          </View>

          <Pressable
            onPress={() => setEnabled((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled }}
            style={[
              styles.toggleRow,
              {
                backgroundColor: surfaceColor,
                borderColor: enabled ? accentColor : separatorColor,
              },
            ]}
          >
            <View style={[styles.toggleIcon, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons name="repeat-outline" size={20} color={accentColor} />
            </View>
            <View style={styles.toggleText}>
              <Text style={[styles.toggleTitle, { color: foregroundColor }]}>
                {intl.formatMessage({
                  id: enabled
                    ? "groceries.panel.recurrenceSheet.disable"
                    : "groceries.panel.recurrenceSheet.enable",
                })}
              </Text>
            </View>

            <View style={styles.toggleIndicator}>
              {enabled ? (
                <Animated.View
                  key="enabled"
                  entering={ZoomIn.duration(180)}
                  exiting={ZoomOut.duration(120)}
                >
                  <Ionicons name="checkmark-circle" size={24} color={accentColor} />
                </Animated.View>
              ) : (
                <Animated.View
                  key="disabled"
                  entering={FadeIn.duration(140)}
                  exiting={FadeOut.duration(100)}
                >
                  <Ionicons name="ellipse-outline" size={24} color={mutedColor} />
                </Animated.View>
              )}
            </View>
          </Pressable>

          {enabled ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(140)}
              style={styles.settingsGroup}
            >
              <Text style={[styles.sectionLabel, { color: mutedColor }]}>
                {intl.formatMessage({ id: "common.recurrence.frequency" })}
              </Text>
              <View style={styles.frequencyGroup}>
                {RULE_OPTIONS.map((option) => {
                  const isSelected = pattern.rule === option.id;

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => handleRuleChange(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.frequencyChip,
                        {
                          backgroundColor: isSelected ? `${accentColor}18` : surfaceColor,
                          borderColor: isSelected ? accentColor : separatorColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={option.icon as React.ComponentProps<typeof Ionicons>["name"]}
                        size={16}
                        color={isSelected ? accentColor : mutedColor}
                      />
                      <Text
                        style={[
                          styles.frequencyLabel,
                          { color: isSelected ? foregroundColor : mutedColor },
                        ]}
                      >
                        {intl.formatMessage({ id: option.labelId })}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: mutedColor }]}>
                {intl.formatMessage({ id: "common.recurrence.interval" })}
              </Text>
              <View style={styles.intervalRow}>
                <Pressable
                  onPress={() => handleIntervalChange(-1)}
                  accessibilityRole="button"
                  disabled={pattern.interval <= 1}
                  style={[
                    styles.stepperButton,
                    {
                      backgroundColor: surfaceColor,
                      borderColor: separatorColor,
                      opacity: pattern.interval <= 1 ? 0.45 : 1,
                    },
                  ]}
                >
                  <Ionicons name="remove" size={18} color={foregroundColor} />
                </Pressable>
                <View style={[styles.intervalValue, { backgroundColor: surfaceColor }]}>
                  <Text style={[styles.intervalNumber, { color: foregroundColor }]}>
                    {pattern.interval}
                  </Text>
                  <Text style={[styles.intervalUnit, { color: mutedColor }]}>
                    {intl.formatMessage({
                      id:
                        pattern.rule === "day"
                          ? pattern.interval === 1
                            ? "common.recurrence.day"
                            : "common.recurrence.days"
                          : pattern.rule === "week"
                            ? pattern.interval === 1
                              ? "common.recurrence.week"
                              : "common.recurrence.weeks"
                            : pattern.interval === 1
                              ? "common.recurrence.month"
                              : "common.recurrence.months",
                    })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleIntervalChange(1)}
                  accessibilityRole="button"
                  style={[
                    styles.stepperButton,
                    { backgroundColor: surfaceColor, borderColor: separatorColor },
                  ]}
                >
                  <Ionicons name="add" size={18} color={foregroundColor} />
                </Pressable>
              </View>

              {showWeekdaySelector ? (
                <>
                  <Text style={[styles.sectionLabel, { color: mutedColor }]}>
                    {intl.formatMessage({ id: "common.recurrence.onDay" })}
                  </Text>
                  <View style={styles.weekdayGroup}>
                    {WEEKDAY_KEYS.map((key, index) => {
                      const isSelected = pattern.weekday === index;

                      return (
                        <Pressable
                          key={key}
                          onPress={() => handleWeekdayChange(index)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          style={[
                            styles.weekdayChip,
                            {
                              backgroundColor: isSelected ? `${accentColor}18` : surfaceColor,
                              borderColor: isSelected ? accentColor : separatorColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.weekdayLabel,
                              { color: isSelected ? foregroundColor : mutedColor },
                            ]}
                          >
                            {intl.formatMessage({ id: `common.recurrence.weekdays.${key}` })}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={[styles.previewCard, { backgroundColor: `${accentColor}12` }]}>
                <View style={styles.previewTitleRow}>
                  <Ionicons name="calendar-outline" size={16} color={accentColor} />
                  <Text style={[styles.previewTitle, { color: foregroundColor }]}>
                    {formatRecurrenceSummary(pattern, formatterTranslations)}
                  </Text>
                </View>
                <Text style={[styles.previewSubtitle, { color: mutedColor }]}>
                  {intl.formatMessage({ id: "common.recurrence.next" })}{" "}
                  {formatNextOccurrence(nextOccurrence, formatterTranslations)}
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <PanelButton variant="primary" onPress={handleConfirm}>
            <Button.Label>
              {intl.formatMessage({ id: "common.actions.save" })}
            </Button.Label>
          </PanelButton>
        </View>
      </View>
    </ShellSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 18,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  toggleRow: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  toggleIndicator: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsGroup: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  frequencyGroup: {
    flexDirection: "row",
    gap: 8,
  },
  frequencyChip: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  frequencyLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  intervalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  intervalValue: {
    minHeight: 46,
    flex: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 6,
  },
  intervalNumber: {
    fontSize: 22,
    fontWeight: "800",
  },
  intervalUnit: {
    fontSize: 13,
    fontWeight: "700",
  },
  weekdayGroup: {
    flexDirection: "row",
    gap: 6,
  },
  weekdayChip: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  previewCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  previewTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  previewSubtitle: {
    marginLeft: 24,
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
});
