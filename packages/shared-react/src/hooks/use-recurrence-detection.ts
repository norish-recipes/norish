import { useEffect, useState, useTransition } from "react";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { createClientLogger } from "@norish/shared/lib/logger";
import { parseRecurrence } from "@norish/shared/lib/recurrence/parser";

const log = createClientLogger("RecurrenceDetection");

type DetectedPattern = {
  pattern: RecurrencePattern;
  cleanText: string;
};

type UseRecurrenceDetectionOptions = {
  itemName: string;
  enabled?: boolean;
};

type CreateUseRecurrenceDetectionOptions = {
  useRecurrenceConfigQuery: () => { recurrenceConfig: any };
};

export function createUseRecurrenceDetection({
  useRecurrenceConfigQuery,
}: CreateUseRecurrenceDetectionOptions) {
  return function useRecurrenceDetection({
    itemName,
    enabled = true,
  }: UseRecurrenceDetectionOptions) {
    "use memo";

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
          const result = parseRecurrence(itemName, recurrenceConfig);

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
  };
}
