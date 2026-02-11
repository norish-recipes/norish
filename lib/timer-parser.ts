export type TimerMatch = {
  originalText: string;
  durationSeconds: number;
  startIndex: number;
  endIndex: number;
  label: string;
};

export type TimerKeywords = {
  hours?: string[];
  minutes?: string[];
  seconds?: string[];
};

/**
 * Parse timer durations from text using configurable keywords
 *
 * Strategy:
 * 1. Find all "number + unit" patterns (e.g., "15 minuten", "20 minutes")
 * 2. For each match, look backwards up to 2 words to find another number
 * 3. If found, it's a range - use the max value (e.g., "12 tot 15 minuten" => 15 minutes)
 * 4. This approach is language-agnostic and works with any range connector
 *
 * Examples handled:
 *   - "20 minutes" => 20 minutes
 *   - "12 to 15 minutes" => 15 minutes
 *   - "12 tot 15 minuten" => 15 minutes (Dutch)
 *   - "1-2 hours" => 2 hours
 *   - "bake for about 10 minutes" => 10 minutes
 *
 * @param text - The text to parse
 * @param keywords - Optional categorized time unit keywords
 * @returns Array of timer matches found in the text
 */
export function parseTimerDurations(text: string, keywords?: TimerKeywords): TimerMatch[] {
  const matches: TimerMatch[] = [];
  const matchedRanges: Array<{ start: number; end: number }> = [];

  // Build keyword groups with their multipliers
  const hourKeywords = keywords?.hours ?? ["hour", "hours", "hr", "hrs", "h"];
  const minuteKeywords = keywords?.minutes ?? ["minute", "minutes", "min", "mins", "m"];
  const secondKeywords = keywords?.seconds ?? ["second", "seconds", "sec", "secs", "s"];

  // Combine all keywords and create a mapping to multipliers
  const keywordToMultiplier = new Map<string, number>();

  hourKeywords.forEach((kw) => {
    keywordToMultiplier.set(kw.toLowerCase(), 3600);
  });
  minuteKeywords.forEach((kw) => {
    keywordToMultiplier.set(kw.toLowerCase(), 60);
  });
  secondKeywords.forEach((kw) => {
    keywordToMultiplier.set(kw.toLowerCase(), 1);
  });

  const allKeywords = [...hourKeywords, ...minuteKeywords, ...secondKeywords];
  const timeUnits = allKeywords.map((kw) => kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  // Helper function to check if a range overlaps with already-matched ranges
  const overlaps = (start: number, end: number): boolean => {
    return matchedRanges.some((range) => {
      return (
        (start >= range.start && start < range.end) ||
        (end > range.start && end <= range.end) ||
        (start <= range.start && end >= range.end)
      );
    });
  };

  // Pattern for HH:MM:SS or HH:MM or M:SS formats
  // Must check what unit (if any) follows to determine interpretation
  const colonPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?/g;
  let colonMatch: RegExpExecArray | null = colonPattern.exec(text);

  while (colonMatch !== null) {
    const first = parseInt(colonMatch[1], 10);
    const second = parseInt(colonMatch[2], 10);
    const third = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
    const colonEnd = colonMatch.index + colonMatch[0].length;

    // Look ahead for time unit keyword after the colon pattern
    const afterText = text.substring(colonEnd, colonEnd + 20);
    const unitMatch = afterText.match(/^\s*([a-z]+)/i);
    const unitAfter = unitMatch ? unitMatch[1].toLowerCase() : null;

    let durationSeconds: number;

    if (colonMatch[3]) {
      // HH:MM:SS format - always hours:minutes:seconds
      durationSeconds = first * 3600 + second * 60 + third;
    } else {
      // HH:MM or M:SS - check following unit keyword
      if (unitAfter && minuteKeywords.some((k) => k.toLowerCase() === unitAfter)) {
        // Unit is "minutes" or variant => interpret as minutes:seconds
        durationSeconds = first * 60 + second;
      } else if (unitAfter && hourKeywords.some((k) => k.toLowerCase() === unitAfter)) {
        // Unit is "hours" or variant => interpret as hours:minutes
        durationSeconds = first * 3600 + second * 60;
      } else {
        // NO unit or unrecognized => default to hours:minutes
        durationSeconds = first * 3600 + second * 60;
      }
    }

    // Construct the original text including the unit ONLY if it's a valid time keyword
    let fullMatch = colonMatch[0];
    let matchEndIndex = colonEnd;

    // Only include the unit if it's actually a recognized time keyword
    const isValidTimeUnit =
      unitAfter &&
      (hourKeywords.some((k) => k.toLowerCase() === unitAfter) ||
        minuteKeywords.some((k) => k.toLowerCase() === unitAfter) ||
        secondKeywords.some((k) => k.toLowerCase() === unitAfter));

    if (isValidTimeUnit && unitMatch) {
      fullMatch += ` ${unitMatch[1]}`;
      matchEndIndex = colonEnd + unitMatch[0].length;
    }

    matches.push({
      originalText: fullMatch.trim(),
      durationSeconds,
      startIndex: colonMatch.index,
      endIndex: matchEndIndex,
      label: fullMatch.trim(),
    });

    // Track this matched range to prevent overlaps
    matchedRanges.push({ start: colonMatch.index, end: matchEndIndex });

    colonMatch = colonPattern.exec(text);
  }

  // Pattern to match "number + unit" (e.g., "15 minuten", "20 minutes")
  // Keywords should include all forms (singular, plural, abbreviations) directly
  const TIME_PATTERN = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${timeUnits})\\b`, "gi");

  let match: RegExpExecArray | null = TIME_PATTERN.exec(text);

  while (match !== null) {
    const primaryNumber = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Skip if this match overlaps with an already-matched colon pattern
    if (!overlaps(matchStart, matchEnd)) {
      // Look backwards from the match to find another number within ~2-3 words
      const beforeText = text.substring(Math.max(0, matchStart - 30), matchStart);

      // Pattern to find a number before this match (looks for last number in the preceding text)
      // This handles: "12 tot 15", "12-15", "12 to 15", "12 or 15", etc.
      // Exclude commas from range detection to avoid treating "10 mins, 5 hrs" as a range
      const priorNumberPattern = /(\d+(?:\.\d+)?)\s*[^\s,]*\s*$/;
      const priorMatch = beforeText.match(priorNumberPattern);

      let rangeStart: number | null = null;
      let fullMatchStart = matchStart;

      if (priorMatch) {
        rangeStart = parseFloat(priorMatch[1]);
        // Adjust the full match start to include the range start
        fullMatchStart = matchStart - (beforeText.length - priorMatch.index!);
      }

      // Look up the multiplier for this keyword
      const multiplier = keywordToMultiplier.get(unit) ?? 60; // Default to minutes

      // Use the maximum value if it's a range, otherwise use the primary number
      const duration = rangeStart !== null ? Math.max(rangeStart, primaryNumber) : primaryNumber;
      const durationSeconds = duration * multiplier;

      // Construct the original text (include range if found)
      const originalText = text.substring(fullMatchStart, matchEnd);

      matches.push({
        originalText: originalText.trim(),
        durationSeconds,
        startIndex: fullMatchStart,
        endIndex: matchEnd,
        label: originalText.trim(),
      });

      // Track this matched range to prevent overlaps
      matchedRanges.push({ start: fullMatchStart, end: matchEnd });
    }

    match = TIME_PATTERN.exec(text);
  }

  return matches;
}
