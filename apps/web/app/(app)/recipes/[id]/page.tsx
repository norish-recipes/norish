"use client";

import { use, useState } from "react";
import { useIngredientIcons } from "@/components/ingredients/ingredient-icon";
import RecipePageTint from "@/components/recipes/recipe-page-tint";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import {
  RecipePageProvider,
  useRecipeQuery,
  useRecipeShareSubscription,
} from "@norish/shared-react/recipes";

import { ScreenWakeLock } from "./components/page-wake-lock";
import RecipePrint from "./components/recipe-print";
import { useRecipeEnrichmentSubscription } from "./components/use-recipe-enrichment";
import { useRecipeSubscription } from "./components/use-recipe-subscription";
import { useAutoConversion } from "./components/use-system-conversion";
import RecipePageDesktop from "./recipe-page-desktop";
import RecipePageMobile from "./recipe-page-mobile";

/** The recipe's, its shares' and its enrichment's events, mounted once for the page. */
function RecipeSubscriptions({ recipeId }: { recipeId: string }) {
  useRecipeSubscription(recipeId);
  useRecipeShareSubscription(recipeId);
  useRecipeEnrichmentSubscription(recipeId);

  return null;
}

function RecipePageContent({ recipeId }: { recipeId: string }) {
  const { recipe, isLoading, error } = useRecipeQuery(recipeId);
  const t = useTranslations("recipes.detail");
  const [printOpen, setPrintOpen] = useState(false);

  useAutoConversion();
  // Every surface of the page names the recipe's foods: its lines, cooking mode, the steps' chips.
  useIngredientIcons(recipe?.recipeIngredients.map((line) => line.ingredientId) ?? []);

  // Still loading — show skeleton while data fetches
  if (isLoading) {
    return <RecipeSkeleton />;
  }

  // Recipe not found or no access - show 404
  if (!recipe && error instanceof TRPCClientError && error.data?.code === "NOT_FOUND") {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFound")} />;
  }

  if (!recipe) {
    return <RecipeSkeleton />;
  }

  return (
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
  );
}

// Only the params: the offline shell renders this page with no search params.
export default function RecipeDetailPage({ params }: Pick<PageProps<"/recipes/[id]">, "params">) {
  const { id } = use(params);

  return (
    <RecipePageProvider recipeId={id}>
      <RecipeSubscriptions recipeId={id} />
      <ScreenWakeLock />
      <RecipePageContent recipeId={id} />
    </RecipePageProvider>
  );
}
