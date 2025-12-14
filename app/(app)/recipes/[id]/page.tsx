"use client";

import { use } from "react";

import RecipePageDesktop from "./recipe-page-desktop";
import RecipePageMobile from "./recipe-page-mobile";
import { RecipeContextProvider, useRecipeContext } from "./context";
import { WakeLockProvider } from "./components/wake-lock-context";

import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { NotFoundView } from "@/components/shared/not-found-view";

type Props = {
  params: Promise<{ id: string }>;
};

function RecipePageContent() {
  const { recipe, isLoading, isNotFound } = useRecipeContext();

  // Show skeleton while loading
  if (isLoading) return <RecipeSkeleton />;

  // Recipe not found or no access - show 404
  if (isNotFound || !recipe) {
    return (
      <NotFoundView
        message="This recipe doesn't exist or you don't have permission to view it."
        title="Recipe Not Found"
      />
    );
  }

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden md:block">
        <RecipePageDesktop />
      </div>

      {/* Mobile layout - full width */}
      <div className="-mx-6 -mt-10 flex w-screen flex-col md:hidden">
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
