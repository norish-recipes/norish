"use client";

import { CalendarContextProvider } from "./context";

import MonthlyCalendar from "@/app/(app)/calendar/components/monthly-calendar";
import {
  DayTimelineMobile,
  DayTimelineDesktop,
} from "@/app/(app)/calendar/components/day-timeline";

export default function CalendarPage() {
  return (
    <CalendarContextProvider>
      <div className="flex min-h-0 w-full flex-1 flex-col md:mx-auto md:max-w-7xl md:p-6 lg:p-8">
        <h1 className="mb-4 shrink-0 text-2xl font-bold">Calendar</h1>

        {/* Mobile */}
        <div className="flex min-h-0 w-full flex-1 flex-col md:hidden">
          <DayTimelineMobile />
        </div>

        {/* Desktop */}
        <div className="hidden min-h-0 w-full flex-1 gap-6 md:grid md:grid-cols-2">
          <div className="h-full">
            <MonthlyCalendar />
          </div>
          <div className="flex h-full min-h-0 flex-col">
            <DayTimelineDesktop />
          </div>
        </div>
      </div>
    </CalendarContextProvider>
  );
}
