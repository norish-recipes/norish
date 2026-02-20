import type {
  RecurrenceConfig,
  RecurrenceLocaleConfig,
  RecurrencePattern,
} from "@/types/recurrence";

export type ParseResult = {
  recurrence: RecurrencePattern | null;
  cleanText: string; // Text with recurrence phrase stripped
  matchedPhrase: string | null; // The exact phrase that was matched
  matchedLocale: string | null; // Which locale matched (e.g., "en", "nl")
};

const TOKEN_BOUNDARY_PREFIX = "(?:^|\\s|[.,!?;:()\\[\\]{}\"'])";
const TOKEN_BOUNDARY_SUFFIX = "(?=$|\\s|[.,!?;:()\\[\\]{}\"'])";

/**
 * Find weekday index by exact match or valid prefix match.
 * Returns the weekday index (0-6) if found, undefined otherwise.
 * Prefers longer matches (e.g., "sunday" over "sun" when typing "sunday").
 */
function findWeekdayIndex(input: string, weekdayWords: Record<string, number>): number | undefined {
  const lowerInput = input.toLowerCase();

  // First, try exact match
  if (weekdayWords[lowerInput] !== undefined) {
    return weekdayWords[lowerInput];
  }

  // Then try prefix match - find all words that start with the input
  const matches = Object.entries(weekdayWords)
    .filter(([word]) => word.startsWith(lowerInput))
    .sort((a, b) => a[0].length - b[0].length); // Sort by length, shortest first

  if (matches.length > 0) {
    return matches[0][1]; // Return the index of the shortest matching word
  }

  return undefined;
}

/**
 * Parse text for recurrence patterns using provided config.
 * Tries all locales and returns the first match found.
 */
export function parseRecurrence(text: string, config: RecurrenceConfig): ParseResult {
  const trimmedText = text.trim();

  // console.log('[parseRecurrence] Parsing text:', trimmedText);

  // Try all locales
  for (const [localeKey, localeConfig] of Object.entries(config.locales)) {
    const result = parseWithLocale(trimmedText, localeConfig, localeKey);

    if (result.recurrence) {
      // console.log('[parseRecurrence] Match found:', result);
      return result;
    }
  }

  // No match found
  // console.log('[parseRecurrence] No match found');
  return {
    recurrence: null,
    cleanText: trimmedText,
    matchedPhrase: null,
    matchedLocale: null,
  };
}

function parseWithLocale(
  text: string,
  config: RecurrenceLocaleConfig,
  localeKey: string
): ParseResult {
  const lowerText = text.toLowerCase();

  // 1. Check interval hints first (e.g., "om de dag")
  for (const hint of config.intervalHints) {
    for (const phrase of hint.phrases) {
      const phraseRegex = new RegExp(
        `${TOKEN_BOUNDARY_PREFIX}(${escapeRegex(phrase)})${TOKEN_BOUNDARY_SUFFIX}`,
        "i"
      );
      const match = lowerText.match(phraseRegex);

      if (match) {
        const matchedPhrase = match[1];
        const cleanText = text
          .replace(new RegExp(escapeRegex(matchedPhrase), "i"), "")
          .trim()
          .replace(/\s+/g, " ");

        return {
          recurrence: {
            rule: hint.rule,
            interval: hint.interval,
          },
          cleanText,
          matchedPhrase,
          matchedLocale: localeKey,
        };
      }
    }
  }

  // 2. Build dynamic pattern: "every [number] [unit] [on weekday]"
  const everyPattern = buildTokenPattern(config.everyWords);
  const otherPattern = buildTokenPattern(config.otherWords);
  const onPattern = buildTokenPattern(config.onWords);

  // Build weekday pattern - match any word that could be a prefix of a weekday
  // Get all unique prefixes (e.g., for "sunday"/"sun": s, su, sun, sund, sunda, sunday)
  const allWeekdayPrefixes = new Set<string>();

  const minPrefixLength = localeKey === "ko" ? 1 : 3;

  for (const word of Object.keys(config.weekdayWords)) {
    // Add all prefixes of this word (minimum 3 chars to avoid false positives)
    for (let i = minPrefixLength; i <= word.length; i++) {
      allWeekdayPrefixes.add(word.substring(0, i));
    }
  }
  // Sort by length DESC so longer matches take precedence
  const weekdayPattern = Array.from(allWeekdayPrefixes)
    .sort((a, b) => b.length - a.length)
    .map((w) => escapeRegex(w))
    .join("|");

  // Build unit patterns
  const dayPattern = buildTokenPattern(config.unitWords.day);
  const weekPattern = buildTokenPattern(config.unitWords.week);
  const monthPattern = buildTokenPattern(config.unitWords.month);

  // Build number pattern (digits or number words)
  const numberWordsPattern = buildTokenPattern(Object.keys(config.numberWords));

  // Pattern: every [other] [number] [unit] [on weekday]
  // Examples: "every day", "every 2 weeks", "elke week op maandag", "every other day"
  const pattern = new RegExp(
    `${TOKEN_BOUNDARY_PREFIX}(${everyPattern})` + // "every"
      `(?:\\s+(${otherPattern}))?` + // optional "other"
      `\\s*` +
      `(?:(\\d+|${numberWordsPattern})\\s*)?` + // optional number
      `(${dayPattern}|${weekPattern}|${monthPattern})` + // required unit
      `(?:\\s+(?:(?:${onPattern})\\s*)?(${weekdayPattern}))?` + // optional "on weekday"
      `${TOKEN_BOUNDARY_SUFFIX}`,
    "i"
  );

  const match = lowerText.match(pattern);

  if (!match) {
    // 3. Check for "every [weekday]" shorthand (e.g., "every friday" -> "every week on friday")
    const everyWeekdayPattern = new RegExp(
      `${TOKEN_BOUNDARY_PREFIX}(${everyPattern})\\s+(${weekdayPattern})${TOKEN_BOUNDARY_SUFFIX}`,
      "i"
    );
    const everyWeekdayMatch = lowerText.match(everyWeekdayPattern);

    if (everyWeekdayMatch) {
      const weekdayStr = everyWeekdayMatch[2];
      const weekdayIndex = findWeekdayIndex(weekdayStr, config.weekdayWords);

      const cleanText = text
        .replace(new RegExp(escapeRegex(everyWeekdayMatch[0]), "i"), "")
        .trim()
        .replace(/\s+/g, " ");

      return {
        recurrence: {
          rule: "week",
          interval: 1,
          weekday: weekdayIndex,
        },
        cleanText,
        matchedPhrase: everyWeekdayMatch[0],
        matchedLocale: localeKey,
      };
    }

    // 3.5. Check for "[weekly/monthly] on [weekday]" pattern (e.g., "weekly on friday", "monthly on the first monday")
    const standaloneWeeklyWords = config.unitWords.week.filter(
      (w) => w.endsWith("ly") || w.endsWith("lijks")
    );
    const standaloneMonthlyWords = config.unitWords.month.filter(
      (w) => w.endsWith("ly") || w.endsWith("lijks")
    );

    if (standaloneWeeklyWords.length > 0) {
      const weeklyOnPattern = new RegExp(
        `${TOKEN_BOUNDARY_PREFIX}(${standaloneWeeklyWords.join("|")})\\s+(?:(?:${onPattern})\\s+)?(${weekdayPattern})${TOKEN_BOUNDARY_SUFFIX}`,
        "i"
      );
      const weeklyOnMatch = lowerText.match(weeklyOnPattern);

      if (weeklyOnMatch) {
        const weekdayStr = weeklyOnMatch[2];
        const weekdayIndex = findWeekdayIndex(weekdayStr, config.weekdayWords);

        const cleanText = text
          .replace(new RegExp(escapeRegex(weeklyOnMatch[0]), "i"), "")
          .trim()
          .replace(/\s+/g, " ");

        return {
          recurrence: {
            rule: "week",
            interval: 1,
            weekday: weekdayIndex,
          },
          cleanText,
          matchedPhrase: weeklyOnMatch[0],
          matchedLocale: localeKey,
        };
      }
    }

    if (standaloneMonthlyWords.length > 0) {
      const monthlyOnPattern = new RegExp(
        `${TOKEN_BOUNDARY_PREFIX}(${standaloneMonthlyWords.join("|")})\\s+(?:(?:${onPattern})\\s+)?(?:the\\s+)?(${weekdayPattern})${TOKEN_BOUNDARY_SUFFIX}`,
        "i"
      );
      const monthlyOnMatch = lowerText.match(monthlyOnPattern);

      if (monthlyOnMatch) {
        const weekdayStr = monthlyOnMatch[2];
        const weekdayIndex = findWeekdayIndex(weekdayStr, config.weekdayWords);

        const cleanText = text
          .replace(new RegExp(escapeRegex(monthlyOnMatch[0]), "i"), "")
          .trim()
          .replace(/\s+/g, " ");

        return {
          recurrence: {
            rule: "month",
            interval: 1,
            weekday: weekdayIndex,
          },
          cleanText,
          matchedPhrase: monthlyOnMatch[0],
          matchedLocale: localeKey,
        };
      }
    }

    // 4. Check for standalone frequency words as fallback (daily, weekly, monthly, dagelijks, wekelijks, maandelijks)
    // This is checked AFTER the main pattern and "every weekday" to avoid matching "weekly" when "every week on friday" is intended
    // Use negative lookahead to avoid matching when "on [weekday]" follows
    const standaloneDailyPattern = config.unitWords.day
      .filter(
        (w) =>
          w.endsWith("ly") || w.endsWith("lijks") || config.everyWords.some((e) => w.startsWith(e))
      )
      .join("|");
    const standaloneWeeklyPattern = config.unitWords.week
      .filter(
        (w) =>
          w.endsWith("ly") || w.endsWith("lijks") || config.everyWords.some((e) => w.startsWith(e))
      )
      .join("|");
    const standaloneMonthlyPattern = config.unitWords.month
      .filter(
        (w) =>
          w.endsWith("ly") || w.endsWith("lijks") || config.everyWords.some((e) => w.startsWith(e))
      )
      .join("|");

    if (standaloneDailyPattern || standaloneWeeklyPattern || standaloneMonthlyPattern) {
      const standalonePattern = new RegExp(
        `${TOKEN_BOUNDARY_PREFIX}(${[standaloneDailyPattern, standaloneWeeklyPattern, standaloneMonthlyPattern].filter(Boolean).join("|")})${TOKEN_BOUNDARY_SUFFIX}` +
          `(?!\\s+(?:${onPattern})\\s+(?:${weekdayPattern}))`, // negative lookahead: don't match if "on weekday" follows
        "i"
      );
      const standaloneMatch = lowerText.match(standalonePattern);

      if (standaloneMatch) {
        const matchedWord = standaloneMatch[1].toLowerCase();
        let rule: "day" | "week" | "month" = "day";

        if (
          standaloneDailyPattern &&
          config.unitWords.day.some((d: string) => d.toLowerCase() === matchedWord)
        ) {
          rule = "day";
        } else if (
          standaloneWeeklyPattern &&
          config.unitWords.week.some((w: string) => w.toLowerCase() === matchedWord)
        ) {
          rule = "week";
        } else if (
          standaloneMonthlyPattern &&
          config.unitWords.month.some((m: string) => m.toLowerCase() === matchedWord)
        ) {
          rule = "month";
        }

        const cleanText = text
          .replace(new RegExp(escapeRegex(standaloneMatch[0]), "i"), "")
          .trim()
          .replace(/\s+/g, " ");

        // For "weekly" without a weekday, default to the current day of the week
        // This makes "weekly" equivalent to "weekly on [today's weekday]"
        const weekday = rule === "week" ? new Date().getDay() : undefined;

        return {
          recurrence: {
            rule,
            interval: 1,
            weekday,
          },
          cleanText,
          matchedPhrase: standaloneMatch[0],
          matchedLocale: localeKey,
        };
      }
    }

    return {
      recurrence: null,
      cleanText: text,
      matchedPhrase: null,
      matchedLocale: null,
    };
  }

  const matchedPhrase = match[0];
  const hasOther = !!match[2];
  const numberStr = match[3];
  const unitStr = match[4];
  const weekdayStr = match[5];

  // Determine interval
  let interval = 1;

  if (hasOther) {
    interval = 2;
  } else if (numberStr) {
    // Try parsing as number word first
    const lowerNumber = numberStr.toLowerCase();

    if (config.numberWords[lowerNumber]) {
      interval = config.numberWords[lowerNumber];
    } else {
      interval = parseInt(numberStr, 10) || 1;
    }
  }

  // Determine rule (day/week/month)
  let rule: "day" | "week" | "month" = "day";

  if (config.unitWords.day.some((d: string) => d.toLowerCase() === unitStr.toLowerCase())) {
    rule = "day";
  } else if (config.unitWords.week.some((w: string) => w.toLowerCase() === unitStr.toLowerCase())) {
    rule = "week";
  } else if (
    config.unitWords.month.some((m: string) => m.toLowerCase() === unitStr.toLowerCase())
  ) {
    rule = "month";
  }

  // Determine weekday (if specified)
  let weekday: number | undefined;

  if (weekdayStr) {
    weekday = findWeekdayIndex(weekdayStr, config.weekdayWords);
  } else if (rule === "week") {
    // For "every week" without a weekday, default to the current day of the week
    // This makes "every week" equivalent to "every week on [today's weekday]"
    weekday = new Date().getDay();
  }

  // Clean the text
  const cleanText = text
    .replace(new RegExp(escapeRegex(matchedPhrase), "i"), "")
    .trim()
    .replace(/\s+/g, " ");

  return {
    recurrence: {
      rule,
      interval,
      weekday,
    },
    cleanText,
    matchedPhrase,
    matchedLocale: localeKey,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTokenPattern(words: string[]): string {
  return words
    .map((word) => escapeRegex(word))
    .sort((a, b) => b.length - a.length)
    .join("|");
}
