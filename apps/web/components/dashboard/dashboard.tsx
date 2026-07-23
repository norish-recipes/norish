"use client";

import CreateRecipeButton from "@/components/dashboard/create-recipe-button";
import FloatingRecipeChip from "@/components/dashboard/floating-recipe-chip";
import RecipeGrid from "@/components/dashboard/recipe-grid";
import RecipeViewModeToggle from "@/components/dashboard/recipe-view-mode-toggle";
import SearchInput from "@/components/dashboard/search-input";
import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { useTranslations } from "next-intl";

/** The dashboard surface shared by the Live route and Offline bootstrap. */
export function Dashboard() {
  const t = useTranslations("recipes.dashboard");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />

      <section
        aria-labelledby="recipe-library-heading"
        className="flex min-h-0 flex-1 flex-col gap-5"
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <h1
              id="recipe-library-heading"
              className="text-foreground text-2xl leading-8 font-semibold"
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

        <div className="min-h-0 flex-1">
          <RecipeGrid />
        </div>
      </section>

      <FloatingRecipeChip />
    </div>
  );
}
