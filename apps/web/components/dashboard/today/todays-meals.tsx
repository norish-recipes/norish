"use client";

import { CalendarContextProvider } from "@/app/(app)/calendar/context";
import { useTodaySectionVisibility } from "@/hooks/use-today-section-visibility";

import TodaysMealsContent from "./todays-meals-content";

export default function TodaysMeals() {
  const [visibility] = useTodaySectionVisibility();

  if (visibility === "hidden") return null;

  return (
    <CalendarContextProvider mode="desktop">
      <TodaysMealsContent visibility={visibility} />
    </CalendarContextProvider>
  );
}
