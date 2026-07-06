"use client";

import { useLocalStorage } from "./use-local-storage";

export type RecipeDashboardViewMode = "grid" | "list";

const RECIPE_DASHBOARD_VIEW_MODE_KEY = "norish:recipe-dashboard-view-mode";

function validateRecipeDashboardViewMode(data: unknown): RecipeDashboardViewMode | null {
  return data === "grid" || data === "list" ? data : null;
}

export function useRecipeDashboardViewMode() {
  return useLocalStorage<RecipeDashboardViewMode>(
    RECIPE_DASHBOARD_VIEW_MODE_KEY,
    "grid",
    validateRecipeDashboardViewMode
  );
}
