"use client";

import type { RecurrencePattern } from "@/types/recurrence";

import { useState, useEffect } from "react";
import { Button, ButtonGroup } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { MinusIcon, PlusIcon, CalendarIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import Panel, { PANEL_HEIGHT_MEDIUM } from "@/components/Panel/Panel";
import {
  formatNextOccurrence,
  formatRecurrenceSummary,
  type RecurrenceTranslations,
} from "@/lib/recurrence/formatter";
import { calculateNextOccurrence, getTodayString } from "@/lib/recurrence/calculator";

type RecurrencePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPattern?: RecurrencePattern | null;
  onSave: (pattern: RecurrencePattern | null) => void;
  returnToPreviousPanel?: () => void;
  height?: number;
};

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function RecurrencePanel({
  open,
  onOpenChange,
  initialPattern,
  onSave,
  returnToPreviousPanel,
  height = PANEL_HEIGHT_MEDIUM,
}: RecurrencePanelProps) {
  const t = useTranslations("common.recurrence");
  const tActions = useTranslations("common.actions");
  const [pattern, setPattern] = useState<RecurrencePattern | null>(initialPattern || null);

  // Build translations object for the formatter
  const formatterTranslations: RecurrenceTranslations = {
    every: t("every"),
    everyOther: t("everyOther"),
    on: t("on"),
    day: t("day"),
    days: t("days"),
    week: t("week"),
    weeks: t("weeks"),
    month: t("month"),
    months: t("months"),
    today: t("today"),
    tomorrow: t("tomorrow"),
    weekdaysFull: {
      "0": t("weekdaysFull.0"),
      "1": t("weekdaysFull.1"),
      "2": t("weekdaysFull.2"),
      "3": t("weekdaysFull.3"),
      "4": t("weekdaysFull.4"),
      "5": t("weekdaysFull.5"),
      "6": t("weekdaysFull.6"),
    },
  };

  // Initialize pattern when panel opens
  useEffect(() => {
    if (open) {
      setPattern(initialPattern || null);
    }
  }, [open, initialPattern]);

  const handlePatternChange = (newPattern: RecurrencePattern) => {
    setPattern(newPattern);
  };

  const handleFrequencyChange = (rule: "day" | "week" | "month") => {
    const newPattern: RecurrencePattern = {
      rule,
      interval: pattern?.interval || 1,
      weekday: rule === "week" || rule === "month" ? (pattern?.weekday ?? 1) : undefined,
    };

    handlePatternChange(newPattern);
  };

  const handleIntervalChange = (delta: number) => {
    if (!pattern) return;
    const newInterval = Math.max(1, pattern.interval + delta);

    handlePatternChange({ ...pattern, interval: newInterval });
  };

  const handleWeekdayChange = (weekday: number) => {
    if (!pattern) return;
    handlePatternChange({ ...pattern, weekday });
  };

  const handleSave = () => {
    onSave(pattern);
    if (returnToPreviousPanel) {
      returnToPreviousPanel();
    } else {
      onOpenChange(false);
    }
  };

  const handleRemove = () => {
    onSave(null);
    if (returnToPreviousPanel) {
      returnToPreviousPanel();
    } else {
      onOpenChange(false);
    }
  };

  const nextOccurrence = pattern ? calculateNextOccurrence(pattern, getTodayString()) : null;

  const showWeekdaySelector = pattern?.rule === "week" || pattern?.rule === "month";

  return (
    <Panel
      height={height}
      open={open}
      title={t("title")}
      onOpenChange={(isOpen) => {
        if (!isOpen && returnToPreviousPanel) {
          returnToPreviousPanel();
        } else {
          onOpenChange(isOpen);
        }
      }}
    >
      <div className="flex flex-col gap-5 pb-2">
        {/* Frequency Selector */}
        <div>
          <span className="text-default-500 mb-2.5 block text-xs font-semibold tracking-wider uppercase">
            {t("frequency")}
          </span>
          <ButtonGroup fullWidth className="shadow-sm" size="md">
            <Button
              className="font-medium"
              color={pattern?.rule === "day" ? "primary" : "default"}
              variant={pattern?.rule === "day" ? "solid" : "flat"}
              onPress={() => handleFrequencyChange("day")}
            >
              {t("daily")}
            </Button>
            <Button
              className="font-medium"
              color={pattern?.rule === "week" ? "primary" : "default"}
              variant={pattern?.rule === "week" ? "solid" : "flat"}
              onPress={() => handleFrequencyChange("week")}
            >
              {t("weekly")}
            </Button>
            <Button
              className="font-medium"
              color={pattern?.rule === "month" ? "primary" : "default"}
              variant={pattern?.rule === "month" ? "solid" : "flat"}
              onPress={() => handleFrequencyChange("month")}
            >
              {t("monthly")}
            </Button>
          </ButtonGroup>
        </div>

        {/* Interval Stepper */}
        {pattern && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span className="text-default-500 mb-2.5 block text-xs font-semibold tracking-wider uppercase">
              {t("interval")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                className="h-8 min-w-8 shrink-0"
                isDisabled={pattern.interval <= 1}
                size="sm"
                variant="flat"
                onPress={() => handleIntervalChange(-1)}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <div className="bg-default-100 flex-1 rounded-lg px-2 py-2.5 text-center">
                <span className="text-foreground text-xl font-bold">{pattern.interval}</span>
                <span className="text-default-500 ml-1.5 text-xs">
                  {pattern.rule === "day"
                    ? pattern.interval === 1
                      ? t("day")
                      : t("days")
                    : pattern.rule === "week"
                      ? pattern.interval === 1
                        ? t("week")
                        : t("weeks")
                      : pattern.interval === 1
                        ? t("month")
                        : t("months")}
                </span>
              </div>
              <Button
                isIconOnly
                className="h-8 min-w-8 shrink-0"
                size="sm"
                variant="flat"
                onPress={() => handleIntervalChange(1)}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Weekday Selector */}
        <AnimatePresence>
          {showWeekdaySelector && pattern && (
            <motion.div
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <span className="text-default-500 mb-2.5 block text-xs font-semibold tracking-wider uppercase">
                {t("onDay")}
              </span>
              <div className="flex gap-1.5">
                {WEEKDAY_KEYS.map((key, index) => (
                  <Button
                    key={index}
                    className="min-w-0 flex-1 text-xs font-medium"
                    color={pattern.weekday === index ? "primary" : "default"}
                    size="sm"
                    variant={pattern.weekday === index ? "solid" : "flat"}
                    onPress={() => handleWeekdayChange(index)}
                  >
                    {t(`weekdays.${key}`)}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Section */}
        <AnimatePresence mode="wait">
          {pattern && (
            <motion.div
              key={JSON.stringify(pattern)}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-primary/5 flex flex-col gap-1.5 rounded-lg px-3 py-2.5"
              exit={{ opacity: 0, scale: 0.95 }}
              initial={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <div className="flex items-center gap-2.5">
                <CalendarIcon className="text-primary h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-semibold">
                    {formatRecurrenceSummary(pattern, formatterTranslations)}
                  </p>
                </div>
              </div>
              {nextOccurrence && (
                <div className="ml-6.5 pl-0.5">
                  <p className="text-default-500 text-xs">
                    {t("next")}{" "}
                    <span className="text-default-700 font-medium">
                      {formatNextOccurrence(nextOccurrence, formatterTranslations)}
                    </span>
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-1">
          {initialPattern && (
            <Button
              className="font-medium"
              color="danger"
              size="sm"
              variant="light"
              onPress={handleRemove}
            >
              {tActions("remove")}
            </Button>
          )}
          <Button
            className="min-w-16 font-medium"
            color="primary"
            isDisabled={!pattern}
            size="sm"
            onPress={handleSave}
          >
            {tActions("done")}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
