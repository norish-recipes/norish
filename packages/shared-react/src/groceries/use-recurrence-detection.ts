import { useEffect, useState, useTransition } from "react";

import type { RecurrenceConfig as StoredRecurrenceConfig } from "@norish/config/zod/server-config";
import type {
  RecurrenceConfig,
  RecurrenceLocaleConfig,
  RecurrencePattern,
} from "@norish/shared/contracts/recurrence";
import { isRecurrenceRule } from "@norish/shared/contracts/recurrence";
import { createClientLogger } from "@norish/shared/lib/logger";
import { parseRecurrence } from "@norish/shared/lib/recurrence/parser";

import { useRecurrenceConfigQuery } from "../config";

const log = createClientLogger("RecurrenceDetection");

type DetectedPattern = {
  pattern: RecurrencePattern;
  cleanText: string;
};

/** The parser reads the four rules; a hint an administrator stored with any other rule is skipped. */
function withKnownRules({ locales }: StoredRecurrenceConfig): RecurrenceConfig {
  const known = Object.entries(locales).map(([locale, words]): [string, RecurrenceLocaleConfig] => [
    locale,
    {
      ...words,
      intervalHints: words.intervalHints.flatMap((hint) =>
        isRecurrenceRule(hint.rule) ? [{ ...hint, rule: hint.rule }] : []
      ),
    },
  ]);

  return { locales: Object.fromEntries(known) };
}

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
    if (!canDetect || !recurrenceConfig) return;

    startTransition(() => {
      try {
        const result = parseRecurrence(itemName, withKnownRules(recurrenceConfig));

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
