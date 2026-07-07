"use client";

import { useLocalStorage } from "./use-local-storage";

export type TodaySectionVisibility = "always" | "planned" | "hidden";

const TODAY_SECTION_VISIBILITY_KEY = "norish:today-section-visibility";

function validateTodaySectionVisibility(data: unknown): TodaySectionVisibility | null {
  return data === "always" || data === "planned" || data === "hidden" ? data : null;
}

export function useTodaySectionVisibility() {
  return useLocalStorage<TodaySectionVisibility>(
    TODAY_SECTION_VISIBILITY_KEY,
    "always",
    validateTodaySectionVisibility
  );
}
