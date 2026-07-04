"use client";

import { CalendarContextProvider } from "@/app/(app)/calendar/context";
import { useUserContext } from "@/context/user-context";

import { getShowTodaySectionPreference } from "@norish/shared/lib/user-preferences";

import TodaysMealsContent from "./todays-meals-content";

export default function TodaysMeals() {
  const { user } = useUserContext();
  const showTodaySection = getShowTodaySectionPreference(user);

  if (!showTodaySection) return null;

  return (
    <CalendarContextProvider mode="desktop">
      <TodaysMealsContent />
    </CalendarContextProvider>
  );
}
