import type { RecurrencePattern, RecurrenceRule } from "@norish/shared/contracts/recurrence";

/** The pattern on a new frequency: the interval stays, and a week or month keeps or takes a weekday. */
export function withRecurrenceRule(
  pattern: RecurrencePattern | null,
  rule: RecurrenceRule
): RecurrencePattern {
  return {
    rule,
    interval: pattern?.interval || 1,
    weekday: rule === "week" || rule === "month" ? (pattern?.weekday ?? 1) : undefined,
  };
}

/** The pattern moved by `delta` intervals, never below one. */
export function stepRecurrenceInterval(
  pattern: RecurrencePattern,
  delta: number
): RecurrencePattern {
  return { ...pattern, interval: Math.max(1, pattern.interval + delta) };
}

/** Whether the frequency asks on which weekday. */
export function recurrenceHasWeekday(pattern: RecurrencePattern | null): boolean {
  return pattern?.rule === "week" || pattern?.rule === "month";
}
