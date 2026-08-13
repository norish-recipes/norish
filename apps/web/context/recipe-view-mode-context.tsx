"use client";

import { createDevicePreferenceContext } from "@/context/device-preference-context";
import { recipeViewModePreference } from "@/lib/recipe-view-mode";

const { Provider: RecipeViewModeProvider, usePreference: useRecipeDashboardViewMode } =
  createDevicePreferenceContext(recipeViewModePreference, "RecipeDashboardViewMode");

export { RecipeViewModeProvider, useRecipeDashboardViewMode };
