"use client";

import { use, useEffect } from "react";
import { useTranslations } from "next-intl";

import RecipePageDesktop from "./recipe-page-desktop";
import RecipePageMobile from "./recipe-page-mobile";
import { RecipeContextProvider, useRecipeContext } from "./context";
import { WakeLockProvider } from "./components/wake-lock-context";

import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";

type Props = {
  params: Promise<{ id: string }>;
};

function RecipePageContent() {
  const { recipe, isNotFound, isLoading } = useRecipeContext();
  const t = useTranslations("recipes.detail");

  // Scroll to top when recipe page mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Still loading — show skeleton while data fetches
  if (isLoading) {
    return <RecipeSkeleton />;
  }

  // Recipe not found or no access - show 404
  if (isNotFound || !recipe) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFound")} />;
  }

  return (
    <>
      {/* Desktop layout - smooth fade in */}
      <div key={recipe?.id} className="fade-in hidden md:block">
        <RecipePageDesktop />
      </div>

      {/* Mobile layout - full width, smooth fade in */}
      <div
        key={recipe?.id}
        className="fade-in -mx-4 -mt-10 flex w-[calc(100%+2rem)] flex-col md:hidden"
      >
        <RecipePageMobile />
      </div>
    </>
  );
}

export default function RecipeDetailPage({ params }: Props) {
  const { id } = use(params);

  return (
    <RecipeContextProvider recipeId={id}>
      <WakeLockProvider>
        <RecipePageContent />
      </WakeLockProvider>
    </RecipeContextProvider>
  );
}
