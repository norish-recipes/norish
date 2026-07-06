"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { CalendarIcon } from "@heroicons/react/16/solid";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import type { RecurrenceTranslations } from "@norish/shared/lib/recurrence/formatter";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";
import {
  formatNextOccurrence,
  formatRecurrenceSummary,
} from "@norish/shared/lib/recurrence/formatter";

type RecurrencePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPattern?: RecurrencePattern | null;
  nested?: boolean;
  onSave: (pattern: RecurrencePattern | null) => void;
  returnToPreviousPanel?: () => void;
};
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export function RecurrencePanel({
  open,
  nested = false,
  onOpenChange,
  initialPattern,
  onSave,
  returnToPreviousPanel,
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
    handlePatternChange({
      ...pattern,
      interval: newInterval,
    });
  };
  const handleWeekdayChange = (weekday: number) => {
    if (!pattern) return;
    handlePatternChange({
      ...pattern,
      weekday,
    });
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
      className={nested ? "contents" : undefined}
      nested={nested}
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
      <Panel.Body className="gap-5">
        {/* Frequency Selector */}
        <div>
          <span className="text-muted mb-2.5 block text-xs font-semibold tracking-wider uppercase">
            {t("frequency")}
          </span>
          <ToggleButtonGroup
            disallowEmptySelection
            fullWidth
            selectedKeys={pattern ? [pattern.rule] : []}
            selectionMode="single"
            size="md"
            onSelectionChange={(keys) => {
              const [rule] = Array.from(keys);

              if (rule === "day" || rule === "week" || rule === "month") {
                handleFrequencyChange(rule);
              }
            }}
          >
            <ToggleButton className="font-medium" id="day">
              {t("daily")}
            </ToggleButton>
            <ToggleButton className="font-medium" id="week">
              <ToggleButtonGroup.Separator />
              {t("weekly")}
            </ToggleButton>
            <ToggleButton className="font-medium" id="month">
              <ToggleButtonGroup.Separator />
              {t("monthly")}
            </ToggleButton>
          </ToggleButtonGroup>
        </div>

        {/* Interval Stepper */}
        {pattern && (
          <motion.div
            animate={{
              opacity: 1,
              y: 0,
            }}
            initial={{
              opacity: 0,
              y: -10,
            }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 25,
            }}
          >
            <span className="text-muted mb-2.5 block text-xs font-semibold tracking-wider uppercase">
              {t("interval")}
            </span>
            <div className="flex items-center gap-2">
              <IconActionButton
                action="decrease"
                className="h-8 min-w-8 shrink-0"
                isDisabled={pattern.interval <= 1}
                label="Decrease interval"
                size="sm"
                onPress={() => handleIntervalChange(-1)}
                tooltipPlacement="bottom"
              />
              <div className="bg-surface-secondary flex-1 rounded-lg px-2 py-2.5 text-center">
                <span className="text-foreground text-xl font-bold">{pattern.interval}</span>
                <span className="text-muted ml-1.5 text-xs">
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
              <IconActionButton
                action="increase"
                className="h-8 min-w-8 shrink-0"
                label="Increase interval"
                size="sm"
                onPress={() => handleIntervalChange(1)}
                tooltipPlacement="bottom"
              />
            </div>
          </motion.div>
        )}

        {/* Weekday Selector */}
        <AnimatePresence>
          {showWeekdaySelector && pattern && (
            <motion.div
              animate={{
                opacity: 1,
                height: "auto",
              }}
              exit={{
                opacity: 0,
                height: 0,
              }}
              initial={{
                opacity: 0,
                height: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
              }}
            >
              <span className="text-muted mb-2.5 block text-xs font-semibold tracking-wider uppercase">
                {t("onDay")}
              </span>
              <ToggleButtonGroup
                disallowEmptySelection
                fullWidth
                selectedKeys={[String(pattern.weekday ?? 1)]}
                selectionMode="single"
                size="sm"
                onSelectionChange={(keys) => {
                  const [weekday] = Array.from(keys);
                  const index = Number(weekday);

                  if (Number.isInteger(index)) {
                    handleWeekdayChange(index);
                  }
                }}
              >
                {WEEKDAY_KEYS.map((key, index) => (
                  <ToggleButton
                    key={index}
                    className="min-w-0 flex-1 px-2 text-xs font-medium"
                    id={String(index)}
                  >
                    {index > 0 && <ToggleButtonGroup.Separator />}
                    {t(`weekdays.${key}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Section */}
        <AnimatePresence mode="wait">
          {pattern && (
            <motion.div
              key={JSON.stringify(pattern)}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              className="bg-surface-secondary flex flex-col gap-3 rounded-xl px-3.5 py-3"
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              <div className="flex items-center gap-2.5">
                <CalendarIcon className="text-accent h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm font-semibold">
                    {formatRecurrenceSummary(pattern, formatterTranslations)}
                  </p>
                </div>
              </div>
              {nextOccurrence && (
                <div className="bg-surface-tertiary text-muted ml-6 flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs">
                  <span>{t("next")}</span>
                  <span className="text-foreground font-medium tabular-nums">
                    {formatNextOccurrence(nextOccurrence, formatterTranslations)}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Panel.Body>
      <Panel.Footer>
        <ActionButtonGroup>
          {initialPattern && (
            <ActionButton action="remove" className="font-medium" onPress={handleRemove}>
              {tActions("remove")}
            </ActionButton>
          )}
          <ActionButton
            action="done"
            className="font-medium"
            isDisabled={!pattern}
            onPress={handleSave}
          >
            {tActions("done")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
