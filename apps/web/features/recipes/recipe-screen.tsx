"use client";

import { useState } from "react";
import { useIngredientIcons } from "@/components/ingredients/ingredient-icon";
import { NotFoundView } from "@/components/shared/not-found-view";
import {
  RecipePageDesktop,
  RecipePageMobile,
  RecipePrint,
  ScreenWakeLock,
} from "@/features/recipes/components/page";
import { RecipePageTint } from "@/features/recipes/components/read-only";
import { RecipeSkeleton } from "@/features/recipes/components/skeleton";
import {
  useAutoConversion,
  useRecipeEnrichmentSubscription,
  useRecipeSubscription,
} from "@/features/recipes/hooks";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import {
  RecipePageProvider,
  useRatingsSubscription,
  useRecipeQuery,
  useRecipeShareSubscription,
} from "@norish/shared-react/recipes";

/** The recipe's, its shares', its enrichment's and its ratings' events, mounted once for the page. */
function RecipeSubscriptions({ recipeId }: { recipeId: string }) {
  useRecipeSubscription(recipeId);
  useRecipeShareSubscription(recipeId);
  useRecipeEnrichmentSubscription(recipeId);
  useRatingsSubscription();

  return null;
}

function RecipePageContent({ recipeId, libraryType }: RecipeScreenProps) {
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
        <RecipePageDesktop libraryType={libraryType} onPrint={() => setPrintOpen(true)} />
      </div>

      {/* Mobile layout - full width, smooth fade in */}
      <div
        key={`${recipe?.id}-mobile`}
        className="fade-in -mx-4 -mt-10 flex w-[calc(100%+2rem)] flex-col md:hidden"
      >
        <RecipePageMobile libraryType={libraryType} onPrint={() => setPrintOpen(true)} />
      </div>
      <RecipePrint open={printOpen} onOpenChange={setPrintOpen} />
    </RecipePageTint>
  );
}

type RecipeScreenProps = {
  recipeId: string;
  /** The Library's lens, which names the way back to it. */
  libraryType: LibraryTypeFilter;
};

/** The recipe page, from the live route or the offline bootstrap for a Warm Set recipe. */
export function RecipeScreen({ recipeId, libraryType }: RecipeScreenProps) {
  return (
    <RecipePageProvider recipeId={recipeId}>
      <RecipeSubscriptions recipeId={recipeId} />
      <ScreenWakeLock />
      <RecipePageContent libraryType={libraryType} recipeId={recipeId} />
    </RecipePageProvider>
  );
}
