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

/** The pattern a name states, or null. The `try` sits outside the hook, which the React Compiler would skip. */
function detect(itemName: string, config: StoredRecurrenceConfig): DetectedPattern | null {
  try {
    const result = parseRecurrence(itemName, withKnownRules(config));

    return result.recurrence ? { pattern: result.recurrence, cleanText: result.cleanText } : null;
  } catch (error) {
    log.error({ err: error }, "Error parsing recurrence");

    return null;
  }
}

type UseRecurrenceDetectionOptions = {
  itemName: string;
  enabled?: boolean;
};

export function useRecurrenceDetection({
  itemName,
  enabled = true,
}: UseRecurrenceDetectionOptions): { detectedPattern: DetectedPattern | null } {
  const { recurrenceConfig } = useRecurrenceConfigQuery();
  // Parsed while rendering: a transition would render the panel twice per name for nothing on screen.
  const detectedPattern =
    enabled && itemName.trim() && recurrenceConfig ? detect(itemName, recurrenceConfig) : null;

  return { detectedPattern };
}
