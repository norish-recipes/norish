import type { TimerMatch } from "@norish/shared/lib/timer-parser";
import { useTimerKeywordsQuery, useTimersEnabledQuery } from "@norish/shared-react/config";
import { markTimers, parseTimerDurations } from "@norish/shared/lib/timer-parser";

/** A step's durations in reading order, and its text with each marked as a timer link; none when timers are off or hidden. */
export function useStepTimers(text: string): { matches: TimerMatch[]; marked: string } {
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();

  if (!timersEnabled || !timerKeywords.enabled) return { matches: [], marked: text };

  const matches = parseTimerDurations(text, {
    hours: timerKeywords.hours,
    minutes: timerKeywords.minutes,
    seconds: timerKeywords.seconds,
  });

  return { matches, marked: markTimers(text, matches) };
}
