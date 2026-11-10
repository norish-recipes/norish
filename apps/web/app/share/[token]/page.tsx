"use client";

import { use, useEffect } from "react";
import RecipePageTint from "@/components/recipes/recipe-page-tint";
import AuthLanguageSelector from "@/components/shared/auth-language-selector";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { TimerTicker } from "@/components/timer-dock";
import { TRPCClientError } from "@trpc/client";
import { useTranslations } from "next-intl";

import { useSharedRecipeQuery } from "@norish/shared-react/recipes";

import { SharedRecipePageDesktop } from "./components/shared-recipe-page-desktop";
import { SharedRecipePageMobile } from "./components/shared-recipe-page-mobile";
import { SharePageProvider } from "./public/share-page-store";

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
export default function SharedRecipePage({ params }: PageProps<"/share/[token]">) {
  const { token } = use(params);

  return (
    <SharePageProvider token={token}>
      <SharedRecipePageContent token={token} />
    </SharePageProvider>
  );
}
