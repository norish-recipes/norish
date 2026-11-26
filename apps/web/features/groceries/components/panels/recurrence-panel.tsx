"use client";

import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { Section } from "@/components/shared/section";
import { CalendarIcon } from "@heroicons/react/16/solid";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";
import { isRecurrenceRule } from "@norish/shared/contracts/recurrence";
import { calculateNextOccurrence, getTodayString } from "@norish/shared/lib/recurrence/calculator";
import {
  formatNextOccurrence,
  formatRecurrenceSummary,
  recurrenceTranslationsFrom,
  recurrenceUnitKey,
} from "@norish/shared/lib/recurrence/formatter";
import {
  recurrenceHasWeekday,
  stepRecurrenceInterval,
  withRecurrenceRule,
} from "@norish/shared/lib/recurrence/pattern";

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
  const [seededFrom, setSeededFrom] = useState({ open, initialPattern });

  const formatterTranslations = recurrenceTranslationsFrom(t);

  // Initialize pattern when panel opens
  if (seededFrom.open !== open || seededFrom.initialPattern !== initialPattern) {
    setSeededFrom({ open, initialPattern });
    if (open) {
      setPattern(initialPattern || null);
    }
  }
  const handlePatternChange = (newPattern: RecurrencePattern) => {
    setPattern(newPattern);
  };
  const handleFrequencyChange = (rule: RecurrenceRule) => {
    handlePatternChange(withRecurrenceRule(pattern, rule));
  };
  const handleIntervalChange = (delta: number) => {
    if (!pattern) return;
    handlePatternChange(stepRecurrenceInterval(pattern, delta));
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
  const showWeekdaySelector = recurrenceHasWeekday(pattern);

  return (
    <Panel
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
      <Panel.Body sections>
        {/* Frequency Selector */}
        <Section placement="panel" title={t("frequency")}>
          <ToggleButtonGroup
            disallowEmptySelection
            fullWidth
            selectedKeys={pattern ? [pattern.rule] : []}
            selectionMode="single"
            size="md"
            onSelectionChange={(keys) => {
              const [rule] = Array.from(keys);

              if (isRecurrenceRule(rule)) {
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
            <ToggleButton className="font-medium" id="year">
              <ToggleButtonGroup.Separator />
              {t("yearly")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Section>

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
            <Section placement="panel" title={t("interval")}>
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
                  <span className="text-muted ml-1.5 text-xs">{t(recurrenceUnitKey(pattern))}</span>
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
            </Section>
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
              <Section placement="panel" title={t("onDay")}>
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
                      key={key}
                      className="min-w-0 flex-1 px-2 text-xs font-medium"
                      id={String(index)}
                    >
                      {index > 0 && <ToggleButtonGroup.Separator />}
                      {t(`weekdays.${key}`)}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Section>
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
        <ActionButtonGroup
          start={
            initialPattern && (
              <ActionButton action="remove" onPress={handleRemove}>
                {tActions("remove")}
              </ActionButton>
            )
          }
        >
          <ActionButton action="done" isDisabled={!pattern} onPress={handleSave}>
            {tActions("done")}
          </ActionButton>
        </ActionButtonGroup>
      </Panel.Footer>
    </Panel>
  );
}
