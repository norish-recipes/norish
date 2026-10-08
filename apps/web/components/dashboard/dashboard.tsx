"use client";

import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import FloatingRecipeChip from "@/components/dashboard/floating-recipe-chip";
import LibraryHeading from "@/components/dashboard/library-heading";
import LibraryTypeChips from "@/components/dashboard/library-type-chips";
import LibraryView from "@/components/dashboard/library-view";
import RecipeViewModeToggle from "@/components/dashboard/recipe-view-mode-toggle";
import SearchInput from "@/components/dashboard/search-input";
import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { useDevicePreference } from "@/context/device-preferences-context";
import { Tabs } from "@heroui/react";

import { RECIPE_VIEW_MODES } from "@norish/shared/contracts/zod/device-preferences";

const LIBRARY_HEADING_ID = "recipe-library-heading";

function RecipeLibrary() {
  const [viewMode, setViewMode] = useDevicePreference("recipeViewMode");

  return (
    <section aria-labelledby={LIBRARY_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <Tabs
        className="min-h-0 flex-1 gap-5"
        selectedKey={viewMode}
        onSelectionChange={(key) => {
          const mode = RECIPE_VIEW_MODES.find((option) => option === key);

          if (mode) setViewMode(mode);
        }}
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <LibraryHeading id={LIBRARY_HEADING_ID} />
            <div className="flex items-center gap-2">
              <RecipeViewModeToggle />
              <CreateRecipeButton />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <SearchInput />
            <LibraryTypeChips />
          </div>
        </div>

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          <LibraryView variant="grid" />
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          <LibraryView variant="list" />
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}

/** The dashboard surface shared by the Live route and Offline bootstrap. */
export function Dashboard() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <RecipeLibrary />
      <FloatingRecipeChip />
    </div>
  );
}
