import { useEffect, useState, useTransition } from "react";

import type { RecurrenceConfig, RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { createClientLogger } from "@norish/shared/lib/logger";
import { parseRecurrence } from "@norish/shared/lib/recurrence/parser";

import { useRecurrenceConfigQuery } from "../config";

const log = createClientLogger("RecurrenceDetection");

type DetectedPattern = {
  pattern: RecurrencePattern;
  cleanText: string;
};

type UseRecurrenceDetectionOptions = {
  itemName: string;
  enabled?: boolean;
};

export function useRecurrenceDetection({
  itemName,
  enabled = true,
}: UseRecurrenceDetectionOptions) {
  const { recurrenceConfig } = useRecurrenceConfigQuery();

  const [detectedPattern, setDetectedPattern] = useState<DetectedPattern | null>(null);
  const [isParsing, startTransition] = useTransition();
  const canDetect = Boolean(enabled && itemName.trim() && recurrenceConfig);

  if (!canDetect && detectedPattern) {
    setDetectedPattern(null);
  }

  useEffect(() => {
    if (!canDetect) return;

    startTransition(() => {
      try {
        // The server's schema keeps a hint's rule as any string; the parser reads the four rules.
        const result = parseRecurrence(itemName, recurrenceConfig as RecurrenceConfig);

        if (result.recurrence) {
          setDetectedPattern({
            pattern: result.recurrence,
            cleanText: result.cleanText,
          });
        } else {
          setDetectedPattern(null);
        }
      } catch (error) {
        log.error({ err: error }, "Error parsing recurrence");
        setDetectedPattern(null);
      }
    });
  }, [itemName, recurrenceConfig, canDetect]);

  return {
    detectedPattern,
    isParsing,
  };
}
