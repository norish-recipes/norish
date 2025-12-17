"use client";

import type { RecurrencePattern } from "@/types/recurrence";

import { motion } from "motion/react";

import { RecurrencePill } from "./recurrence-pill";

import { calculateNextOccurrence, getTodayString } from "@/lib/recurrence/calculator";

type RecurrenceSuggestionProps = {
  pattern: RecurrencePattern;
  itemName: string;
  amount?: number | null;
  unit?: string | null;
  type: "detected" | "confirmed";
  onConfirm?: (e?: React.MouseEvent) => void;
  onReplace?: (e?: React.MouseEvent) => void;
  onRemove?: () => void;
  onEdit?: (e?: React.MouseEvent) => void;
};

export function RecurrenceSuggestion({
  pattern,
  itemName,
  amount,
  unit,
  type,
  onConfirm,
  onReplace,
  onRemove,
  onEdit,
}: RecurrenceSuggestionProps) {
  const today = getTodayString();
  const nextDate = calculateNextOccurrence(pattern, today);

  const mockRecurring = {
    id: type,
    userId: "",
    name: itemName || "Item",
    amount: amount ?? null,
    unit: unit ?? null,
    recurrenceRule: pattern.rule,
    recurrenceInterval: pattern.interval,
    recurrenceWeekday: pattern.weekday ?? null,
    nextPlannedFor: nextDate,
    lastCheckedDate: null,
  };

  const isDetected = type === "detected";

  // Determine the click handler based on available props and type
  const handleClick = (e?: React.MouseEvent) => {
    if (isDetected) {
      if (onReplace) onReplace(e);
      else if (onConfirm) onConfirm(e);
    } else {
      if (onEdit) onEdit(e);
    }
  };

  return (
    <motion.div
      layout
      animate={isDetected ? { opacity: 1, scale: 1, x: 0 } : { opacity: 1, scale: 1 }}
      exit={isDetected ? { opacity: 0, scale: 0.9, x: -10 } : { opacity: 0, scale: 0.9 }}
      initial={isDetected ? { opacity: 0, scale: 0.9, x: -10 } : { opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <RecurrencePill
        className={
          isDetected
            ? "!bg-default-100 !text-default-600 dark:!bg-default-50 dark:!text-default-700 border-2 border-dashed opacity-70 transition-opacity hover:opacity-100"
            : ""
        }
        recurringGrocery={mockRecurring}
        showRemove={!isDetected} // Confirmed patterns show remove
        subtle={isDetected}
        onClick={handleClick}
        onRemove={onRemove}
      />
    </motion.div>
  );
}
