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
    const { recurrenceConfig } = useRecurrenceConfigQuery();

    const [detectedPattern, setDetectedPattern] = useState<DetectedPattern | null>(null);
    const [isParsing, startTransition] = useTransition();

    useEffect(() => {
      if (!enabled || !itemName.trim() || !recurrenceConfig) {
        setDetectedPattern(null);

        return;
      }

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
    }, [itemName, recurrenceConfig, enabled]);

    return {
      detectedPattern,
      isParsing,
    };
  };
}
