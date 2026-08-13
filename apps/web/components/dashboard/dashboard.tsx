"use client";

import type { RecipeDashboardViewMode } from "@/lib/recipe-view-mode";
import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import FloatingRecipeChip from "@/components/dashboard/floating-recipe-chip";
import RecipeGrid from "@/components/dashboard/recipe-grid";
import RecipeViewModeToggle from "@/components/dashboard/recipe-view-mode-toggle";
import SearchInput from "@/components/dashboard/search-input";
import TodaysMeals from "@/components/dashboard/today/todays-meals";
import {
  RecipeViewModeProvider,
  useRecipeDashboardViewMode,
} from "@/context/recipe-view-mode-context";
import { recipeViewModePreference } from "@/lib/recipe-view-mode";
import { Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

function RecipeLibrary() {
  const t = useTranslations("recipes.dashboard");
  const [viewMode, setViewMode] = useRecipeDashboardViewMode();

  return (
    <section aria-labelledby="recipe-library-heading" className="flex min-h-0 flex-1 flex-col">
      <Tabs
        className="min-h-0 flex-1 gap-5"
        selectedKey={viewMode}
        onSelectionChange={(key) => setViewMode(recipeViewModePreference.parse(String(key)))}
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <h1
              className="text-foreground text-2xl leading-8 font-semibold"
              id="recipe-library-heading"
            >
              {t("title")}
            </h1>
            <div className="flex items-center gap-2">
              <RecipeViewModeToggle />
              <CreateRecipeButton />
            </div>
          </div>

          <div className="min-w-0">
            <SearchInput />
          </div>
        </div>

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          <RecipeGrid variant="grid" />
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          <RecipeGrid variant="list" />
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}

/**
 * The dashboard surface shared by the Live route and Offline bootstrap.
 *
 * `initialViewMode` comes from the cookie the Live route read on the server;
 * the Offline bootstrap has no server pass and lets the provider read it.
 */
export function Dashboard({ initialViewMode }: { initialViewMode?: RecipeDashboardViewMode }) {
  return (
    <RecipeViewModeProvider initialValue={initialViewMode}>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
        <TodaysMeals />
        <RecipeLibrary />
        <FloatingRecipeChip />
      </div>
    </RecipeViewModeProvider>
  );
}
