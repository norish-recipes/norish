"use client";

import { use, useState } from "react";
import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import RecipePageTint from "@/components/recipes/recipe-page-tint";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { useTranslations } from "next-intl";

import RecipePrint from "./components/recipe-print";
import { useAutoConversion } from "./components/use-system-conversion";
import { WakeLockProvider } from "./components/wake-lock-context";
import { RecipeContextProvider, useRecipeContext } from "./context";
import RecipePageDesktop from "./recipe-page-desktop";
import RecipePageMobile from "./recipe-page-mobile";

function RecipePageContent() {
  const { recipe, isNotFound, isLoading } = useRecipeContext();
  const t = useTranslations("recipes.detail");
  const [printOpen, setPrintOpen] = useState(false);

  useAutoConversion();

  // Still loading — show skeleton while data fetches
  if (isLoading) {
    return <RecipeSkeleton />;
  }

  // Recipe not found or no access - show 404
  if (!recipe && isNotFound) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFound")} />;
  }

  if (!recipe) {
    return <RecipeSkeleton />;
  }

  return (
    // Every surface of the page names the recipe's foods: its lines, cooking mode, the steps' chips.
    <IngredientIconsProvider ids={recipe.recipeIngredients.map((line) => line.ingredientId)}>
      <RecipePageTint dishColor={recipe.dishColor}>
        {/* Desktop layout - smooth fade in */}
        <div key={`${recipe?.id}-desktop`} className="fade-in hidden md:block">
          <RecipePageDesktop onPrint={() => setPrintOpen(true)} />
        </div>

        {/* Mobile layout - full width, smooth fade in */}
        <div
          key={`${recipe?.id}-mobile`}
          className="fade-in -mx-4 -mt-10 flex w-[calc(100%+2rem)] flex-col md:hidden"
        >
          <RecipePageMobile onPrint={() => setPrintOpen(true)} />
        </div>
        <RecipePrint open={printOpen} onOpenChange={setPrintOpen} />
      </RecipePageTint>
    </IngredientIconsProvider>
  );
}

// Only the params: the offline shell renders this page with no search params.
export default function RecipeDetailPage({ params }: Pick<PageProps<"/recipes/[id]">, "params">) {
  const { id } = use(params);

  return (
    <RecipeContextProvider recipeId={id}>
      <WakeLockProvider>
        <RecipePageContent />
      </WakeLockProvider>
    </RecipeContextProvider>
  );
}
