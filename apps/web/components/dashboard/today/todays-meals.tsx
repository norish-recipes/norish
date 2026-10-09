"use client";

import { CalendarContextProvider } from "@/app/(app)/calendar/context";
import { useDevicePreference } from "@/context/device-preferences-context";

import TodaysMealsContent from "./todays-meals-content";

export default function TodaysMeals() {
  const [visibility] = useDevicePreference("todaySectionVisibility");

  if (visibility === "hidden") return null;

  return (
    <CalendarContextProvider mode="desktop">
      <TodaysMealsContent visibility={visibility} />
    </CalendarContextProvider>
  );
}
