import { useIntl } from "react-intl";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import {
  formatRecurrenceSummary,
  recurrenceTranslationsFrom,
} from "@norish/shared/lib/recurrence/formatter";

/** How a repeat reads in the reader's language: "Every other week on Friday". */
export function useRecurrenceLabel(): (pattern: RecurrencePattern) => string {
  const intl = useIntl();
  const words = recurrenceTranslationsFrom((key, values) =>
    intl.formatMessage({ id: `common.recurrence.${key}` }, values)
  );

  return (pattern) => formatRecurrenceSummary(pattern, words);
}
