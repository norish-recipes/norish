"use client";

import { RecurrenceSuggestion } from "@/app/(app)/groceries/components/recurrence-suggestion";
import { ActionButton } from "@/components/shared/action-button";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

/** A rhythm read out of the grocery's name as it is typed. */
interface DetectedPattern {
  pattern: RecurrencePattern;
  cleanText: string;
}

interface GroceryRecurrenceControlProps {
  itemName: string;
  /** What the name suggests, offered as a pill to take. */
  detectedPattern: DetectedPattern | null;
  /** The rhythm the grocery has, or will have on Save. */
  confirmedPattern: RecurrencePattern | null;
  onConfirmDetected: (detected: DetectedPattern) => void;
  /** Open the recurrence editor, to set a rhythm or change the one there is. */
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * How often a grocery comes back, directly under what it is: the pills for a
 * rhythm the name suggests and for the one confirmed, or, where there is
 * neither, the way to the editor. The add and edit panels show the same
 * thing in the same place.
 */
export function GroceryRecurrenceControl({
  itemName,
  detectedPattern,
  confirmedPattern,
  onConfirmDetected,
  onEdit,
  onRemove,
}: GroceryRecurrenceControlProps) {
  const t = useTranslations("groceries.panel");

  if (!detectedPattern && !confirmedPattern) {
    return (
      <ActionButton
        action="add"
        className="min-w-16 font-medium"
        size="sm"
        variant="tertiary"
        onPress={onEdit}
      >
        {t("addRepeat")}
      </ActionButton>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      <div className="flex flex-wrap items-center gap-2">
        {detectedPattern && (
          <RecurrenceSuggestion
            key="detected"
            itemName={itemName}
            pattern={detectedPattern.pattern}
            type="detected"
            onReplace={() => onConfirmDetected(detectedPattern)}
          />
        )}
        {confirmedPattern && (
          <RecurrenceSuggestion
            key="confirmed"
            itemName={itemName}
            pattern={confirmedPattern}
            type="confirmed"
            onEdit={onEdit}
            onRemove={onRemove}
          />
        )}
      </div>
    </AnimatePresence>
  );
}
