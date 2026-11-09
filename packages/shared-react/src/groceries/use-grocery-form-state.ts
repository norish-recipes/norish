import { useCallback, useState } from "react";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

type DetectedPattern = {
  pattern: RecurrencePattern;
  cleanText: string;
};

export function useGroceryFormState(initialName = "") {
  const [itemName, setItemName] = useState(initialName);
  const [confirmedPattern, setConfirmedPattern] = useState<RecurrencePattern | null>(null);

  const handleConfirmPattern = useCallback((detected: DetectedPattern | null) => {
    if (!detected) return;
    setConfirmedPattern(detected.pattern);
    setItemName(detected.cleanText);
  }, []);

  const handleRemovePattern = useCallback(() => {
    setConfirmedPattern(null);
  }, []);

  const reset = useCallback(() => {
    setItemName("");
    setConfirmedPattern(null);
  }, []);

  return {
    itemName,
    setItemName,
    confirmedPattern,
    setConfirmedPattern,
    handleConfirmPattern,
    handleRemovePattern,
    reset,
  };
}
