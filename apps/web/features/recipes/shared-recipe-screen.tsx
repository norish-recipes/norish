"use client";

import { useEffect } from "react";
import { AuthLanguageSelector } from "@/components/shared/auth-language-selector";
import { NotFoundView } from "@/components/shared/not-found-view";
import { TimerTicker } from "@/components/timer-dock";
import RecipePageTint from "@/features/recipes/components/read-only/recipe-page-tint";
import { SharedRecipePageDesktop } from "@/features/recipes/components/share/shared-recipe-page-desktop";
import { SharedRecipePageMobile } from "@/features/recipes/components/share/shared-recipe-page-mobile";
import RecipeSkeleton from "@/features/recipes/components/skeleton/recipe-skeleton";
import { SharePageProvider } from "@/features/recipes/lib/share-page-store";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import { useSharedRecipeQuery } from "@norish/shared-react/recipes";

function SharedRecipePageContent({ token }: { token: string }) {
  const { recipe, isLoading, error } = useSharedRecipeQuery(token);
  const t = useTranslations("recipes.detail");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  if (isLoading) {
    return <RecipeSkeleton shared />;
  }
  if (!recipe || (error instanceof TRPCClientError && error.data?.code === "NOT_FOUND")) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFound")} />;
  }

  return (
    <>
      <TimerTicker />
      <div className="hidden justify-end pt-4 md:flex md:px-6">
        <AuthLanguageSelector />
      </div>
      <RecipePageTint dishColor={recipe.dishColor}>
        <SharedRecipePageDesktop />
        <SharedRecipePageMobile />
      </RecipePageTint>
    </>
  );
}

export function SharedRecipeScreen({ token }: { token: string }) {
  return (
    <SharePageProvider token={token}>
      <SharedRecipePageContent token={token} />
    </SharePageProvider>
  );
}
