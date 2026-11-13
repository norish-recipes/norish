"use client";

import { useDevicePreference } from "@norish/shared-react/reader";

import TodaysMealsContent from "./todays-meals-content";

export default function TodaysMeals() {
  const [visibility] = useDevicePreference("todaySectionVisibility");

  if (visibility === "hidden") return null;

  return <TodaysMealsContent visibility={visibility} />;
}
