import type { RecurrencePattern } from "@/types/recurrence";

import {
  addDays,
  addWeeks,
  addMonths,
  startOfDay,
  isAfter,
  isBefore,
  isSameDay,
  getDay,
  format,
  parseISO,
} from "date-fns";

/**
 * Calculate the next occurrence date based on a recurrence pattern.
 * If fromDate is provided, calculate from that date (when item is checked).
 *
 * @param pattern - The recurrence pattern
 * @param currentNextDate - Current next planned date (as date string YYYY-MM-DD) or today for new items
 * @param fromDate - Optional base date to calculate from (for check date when item is checked)
 * @returns Next occurrence as date string YYYY-MM-DD
 */
export function calculateNextOccurrence(
  pattern: RecurrencePattern,
  currentNextDate: string,
  fromDate?: string
): string {
  const today = startOfDay(new Date());
  // When fromDate is provided (item is being checked), use it as base for calculation
  // When fromDate is not provided (creating new item), use currentNextDate
  const baseDate = fromDate
    ? startOfDay(parseISO(fromDate))
    : startOfDay(parseISO(currentNextDate));
  const isNewItem = !fromDate && isSameDay(baseDate, today);

  let nextDate: Date;

  switch (pattern.rule) {
    case "day":
      // For new items, start today
      // For checked items, add interval from the check date (fromDate)
      if (isNewItem) {
        nextDate = today;
        // // console.log('[calculateNextOccurrence] Daily new item: starting today');
      } else {
        nextDate = addDays(baseDate, pattern.interval);
        // // console.log(`[calculateNextOccurrence] Daily existing: adding ${pattern.interval} days to ${format(baseDate, 'yyyy-MM-dd')} = ${format(nextDate, 'yyyy-MM-dd')}`);
      }
      // Advance by full intervals until not in the past
      while (isBefore(nextDate, today)) {
        nextDate = addDays(nextDate, pattern.interval);
      }
      break;

    case "week":
      if (pattern.weekday !== undefined) {
        nextDate = calculateNextWeekday(baseDate, pattern.interval, pattern.weekday, isNewItem);
      } else {
        if (isNewItem) {
          nextDate = today;
        } else {
          nextDate = addWeeks(baseDate, pattern.interval);
        }
        while (isBefore(nextDate, today)) {
          nextDate = addWeeks(nextDate, pattern.interval);
        }
      }
      break;

    case "month":
      if (pattern.weekday !== undefined) {
        nextDate = calculateNextMonthlyWeekday(
          baseDate,
          pattern.interval,
          pattern.weekday,
          isNewItem
        );
      } else {
        if (isNewItem) {
          nextDate = today;
        } else {
          nextDate = addMonths(baseDate, pattern.interval);
        }
        // Advance by full intervals until not in the past
        while (isBefore(nextDate, today)) {
          nextDate = addMonths(nextDate, pattern.interval);
        }
      }
      break;

    default:
      nextDate = addDays(baseDate, 1);
  }

  const result = format(nextDate, "yyyy-MM-dd");

  return result;
}

/**
 * Calculate next occurrence for weekly pattern with specific weekday.
 * Example: "every week on Monday" or "every 2 weeks on Thursday"
 */
function calculateNextWeekday(
  baseDate: Date,
  intervalWeeks: number,
  targetWeekday: number, // 0-6 (Sun-Sat)
  isNewItem: boolean = false
): Date {
  const today = startOfDay(new Date());
  const currentWeekday = getDay(today);

  // For new items, find the next occurrence of target weekday (including today if it matches)
  if (isNewItem) {
    // If today is the target weekday, start today
    if (currentWeekday === targetWeekday) {
      return today;
    }

    // Find next occurrence of target weekday
    let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

    if (daysUntilTarget === 0) daysUntilTarget = 7; // If same day, go to next week

    const nextDate = addDays(today, daysUntilTarget);

    return nextDate;
  }

  // For existing items (checking off), find the next target weekday
  // that is at least intervalWeeks weeks after the baseDate

  // First, find the next occurrence of target weekday from baseDate
  const baseDateWeekday = getDay(baseDate);
  let daysToTarget = (targetWeekday - baseDateWeekday + 7) % 7;

  // If baseDate is already on target weekday, we need to go to the next one
  if (daysToTarget === 0) daysToTarget = 7;

  let nextDate = addDays(baseDate, daysToTarget);

  // Now add full interval weeks (minus 1 since we already moved to the next weekday)
  if (intervalWeeks > 1) {
    nextDate = addWeeks(nextDate, intervalWeeks - 1);
  }

  // Advance by full intervals (preserving weekday) until not in the past
  while (isBefore(nextDate, today)) {
    nextDate = addWeeks(nextDate, intervalWeeks);
  }

  return nextDate;
}

/**
 * Calculate next occurrence for monthly pattern with specific weekday.
 * Example: "every month on Thursday" - find closest Thursday in next month
 */
function calculateNextMonthlyWeekday(
  baseDate: Date,
  intervalMonths: number,
  targetWeekday: number, // 0-6 (Sun-Sat)
  isNewItem: boolean = false
): Date {
  const today = startOfDay(new Date());
  const currentWeekday = getDay(today);

  // For new items, find the next occurrence of target weekday
  if (isNewItem) {
    // If today is the target weekday, start today
    if (currentWeekday === targetWeekday) {
      return today;
    }

    // Check if target weekday is still ahead this week
    let daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

    if (daysUntilTarget === 0) daysUntilTarget = 7;

    const nextDate = addDays(today, daysUntilTarget);

    return nextDate;
  }

  // For existing items (checking off), add the interval from baseDate

  const nextMonth = addMonths(baseDate, intervalMonths);
  const nextMonthWeekday = getDay(nextMonth);
  let daysToAdd = (targetWeekday - nextMonthWeekday + 7) % 7;
  let nextDate = addDays(nextMonth, daysToAdd);

  // Ensure we never go backwards from today
  while (isBefore(nextDate, today)) {
    const anotherMonth = addMonths(nextDate, intervalMonths);
    const anotherWeekday = getDay(anotherMonth);

    daysToAdd = (targetWeekday - anotherWeekday + 7) % 7;
    nextDate = addDays(anotherMonth, daysToAdd);
  }

  return nextDate;
}

/**
 * Check if a recurring item should be active (visible and unchecked) today.
 *
 * @param nextPlannedFor - When the item is next planned (YYYY-MM-DD)
 * @param lastCheckedDate - When the item was last checked (YYYY-MM-DD or null)
 * @returns true if item should be active today
 */
export function shouldBeActive(nextPlannedFor: string, lastCheckedDate: string | null): boolean {
  const today = startOfDay(new Date());
  const plannedDate = startOfDay(parseISO(nextPlannedFor));

  // Item is due if today >= planned date
  const isDue = isSameDay(today, plannedDate) || isAfter(today, plannedDate);

  if (!isDue) {
    return false;
  }

  // If never checked, it's active
  if (!lastCheckedDate) {
    return true;
  }

  const lastChecked = startOfDay(parseISO(lastCheckedDate));

  // If last checked is before today, it should be unchecked (active)
  return isBefore(lastChecked, today);
}

/**
 * Check if a recurring item is overdue (past due date and not checked today).
 *
 * @param nextPlannedFor - When the item is next planned (YYYY-MM-DD)
 * @param lastCheckedDate - When the item was last checked (YYYY-MM-DD or null)
 * @returns true if item is overdue
 */
export function isOverdue(nextPlannedFor: string, lastCheckedDate: string | null): boolean {
  const today = startOfDay(new Date());
  const plannedDate = startOfDay(parseISO(nextPlannedFor));

  // Not overdue if not yet due
  if (isBefore(today, plannedDate)) {
    return false;
  }

  // If checked today, not overdue
  if (lastCheckedDate) {
    const lastChecked = startOfDay(parseISO(lastCheckedDate));

    if (isSameDay(lastChecked, today)) {
      return false;
    }
  }

  // Overdue if today is after planned date
  return isAfter(today, plannedDate);
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
export function getTodayString(): string {
  return format(startOfDay(new Date()), "yyyy-MM-dd");
}
