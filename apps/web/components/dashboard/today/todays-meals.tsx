"use client";

import { CalendarContextProvider } from "@/app/(app)/calendar/context";

import TodaysMealsContent from "./todays-meals-content";

export default function TodaysMeals() {
  return (
    <CalendarContextProvider mode="desktop">
      <TodaysMealsContent />
    </CalendarContextProvider>
  );
}
