"use client";

import type { RecurringGroceryDto } from "@/types";

import { motion } from "motion/react";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/16/solid";

import { formatRecurrenceSummary, formatNextOccurrence } from "@/lib/recurrence/formatter";
import { isOverdue } from "@/lib/recurrence/calculator";

type RecurrencePillProps = {
  recurringGrocery: RecurringGroceryDto;
  subtle?: boolean;
  showRemove?: boolean;
  onRemove?: () => void;
  onClick?: (e?: React.MouseEvent) => void;
  className?: string;
};

export function RecurrencePill({
  recurringGrocery,
  subtle = false,
  showRemove = false,
  onRemove,
  onClick,
  className = "",
}: RecurrencePillProps) {
  const pattern = {
    rule: recurringGrocery.recurrenceRule as "day" | "week" | "month",
    interval: recurringGrocery.recurrenceInterval,
    weekday: recurringGrocery.recurrenceWeekday ?? undefined,
  };

  const summary = formatRecurrenceSummary(pattern);
  const nextDateText = formatNextOccurrence(recurringGrocery.nextPlannedFor);
  const nextText = nextDateText;
  const overdue = isOverdue(recurringGrocery.nextPlannedFor, recurringGrocery.lastCheckedDate);

  const bgColor = overdue
    ? "bg-danger/10 text-danger border border-danger/20"
    : subtle
      ? "bg-default-100 text-default-600 dark:bg-default-50"
      : "bg-primary/10 text-primary";

  const PillComponent = onClick ? motion.button : motion.div;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
  };

  return (
    <PillComponent
      className={`inline-flex flex-wrap items-center gap-1 rounded-full px-2.5 py-1 text-xs ${bgColor} ${onClick ? "cursor-pointer" : ""} ${className}`}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      type={onClick ? "button" : undefined}
      whileHover={onClick ? { scale: 1.05 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick ? handleClick : undefined}
    >
      <ArrowPathIcon className="h-3.5 w-3.5" />
      <span className="font-semibold tracking-tight">{summary}</span>
      {nextText && (
        <>
          <span className="text-[0.7rem] font-medium opacity-50">•</span>
          <span className="text-default-500 text-[0.7rem] font-medium italic">{nextText}</span>
        </>
      )}
      {showRemove && onRemove && (
        <span
          aria-label="Remove recurrence"
          className="hover:bg-default-200/50 ml-0.5 cursor-pointer rounded-full p-0.5 transition-colors"
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
        >
          <XMarkIcon className="h-3 w-3" />
        </span>
      )}
    </PillComponent>
  );
}
