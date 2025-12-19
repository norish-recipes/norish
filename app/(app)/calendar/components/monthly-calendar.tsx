"use client";

import { useCallback, useMemo, useState } from "react";

import { useCalendarContext } from "../context";

import { endOfMonth, startOfMonth, dateKey } from "@/lib/helpers";
import { PlannedRecipeViewDto } from "@/types";
import MonthlyCalendarSkeleton from "@/components/skeleton/monthly-calendar-skeleton";

type DayCell = {
  date: Date;
  inCurrentMonth: boolean;
  items: PlannedRecipeViewDto[];
};

function getMonthDaysGrid(baseDate: Date): DayCell[] {
  const start = startOfMonth(baseDate);
  const end = endOfMonth(baseDate);

  const startWeekday = (start.getDay() + 6) % 7;
  const daysInMonth = end.getDate();
  const days: DayCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = new Date(start);

    d.setDate(start.getDate() - (i + 1));
    days.push({ date: d, inCurrentMonth: false, items: [] });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(start);

    d.setDate(i);
    days.push({ date: d, inCurrentMonth: true, items: [] });
  }

  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last);

    d.setDate(last.getDate() + 1);
    days.push({ date: d, inCurrentMonth: false, items: [] });
  }

  while (days.length < 42) {
    const last = days[days.length - 1].date;
    const d = new Date(last);

    d.setDate(last.getDate() + 1);
    days.push({ date: d, inCurrentMonth: false, items: [] });
  }

  return days;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthlyCalendar() {
  const today = useMemo(() => new Date(), []);
  const [offset, setOffset] = useState(0);
  const viewDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() + offset, 1),
    [today, offset]
  );
  const days = useMemo(() => getMonthDaysGrid(viewDate), [viewDate]);
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }),
    []
  );

  const { plannedItemsByDate, isLoading } = useCalendarContext();
  const slotOrder = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };

  const onPrevMonth = useCallback(() => setOffset((o) => Math.max(-1, o - 1)), []);
  const onNextMonth = useCallback(() => setOffset((o) => Math.min(1, o + 1)), []);

  const isToday = (d: Date) => {
    const n = new Date();

    return (
      d.getFullYear() === n.getFullYear() &&
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate()
    );
  };

  if (isLoading) return <MonthlyCalendarSkeleton />;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthFormatter.format(viewDate)}</h2>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            className="rounded-medium border-default-200 hover:bg-default-100 border px-2 py-1 text-base disabled:cursor-not-allowed disabled:opacity-50"
            disabled={offset <= -1}
            type="button"
            onClick={onPrevMonth}
          >
            ← Prev
          </button>
          <button
            aria-label="Next month"
            className="rounded-medium border-default-200 hover:bg-default-100 border px-2 py-1 text-base disabled:cursor-not-allowed disabled:opacity-50"
            disabled={offset >= 1}
            type="button"
            onClick={onNextMonth}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="text-default-500 grid grid-cols-7 gap-1 text-xs">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1 text-center">
            {w}
          </div>
        ))}
      </div>

      <div className="rounded-medium border-default-200 grid grid-cols-7 gap-1 overflow-hidden border">
        {days.map((cell, idx) => (
          <div
            key={idx}
            className={
              "border-default-100 flex aspect-square min-h-20 cursor-pointer flex-col gap-1 p-2 " +
              (idx >= 7 ? "border-t" : "") +
              (idx % 7 !== 0 ? " border-l" : "") +
              (cell.inCurrentMonth ? " bg-content1" : " bg-default-50 text-default-400")
            }
          >
            <div className="flex items-center justify-between">
              <span
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium " +
                  (isToday(cell.date) ? " bg-primary/10 text-primary border-primary/30 border" : "")
                }
              >
                {cell.date.getDate()}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(plannedItemsByDate[dateKey(cell.date)] ?? [])
                .sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot])
                .map((it) => {
                  const title = it.itemType === "recipe" ? (it.recipeName ?? "") : it.title;

                  return (
                    <span
                      key={it.id}
                      className="bg-primary inline-block h-1.5 w-1.5 rounded-full"
                      title={title}
                    />
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
