"use client";

import { use, useEffect } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { OfflineDataUnavailable } from "@/components/offline-data-unavailable";
import { NotFoundView } from "@/components/shared/not-found-view";
import RecipeSkeleton from "@/components/skeleton/recipe-skeleton";
import { useOfflineWeb } from "@/context/offline-web-context";
import { useTranslations } from "next-intl";

import { WakeLockProvider } from "./components/wake-lock-context";
import { RecipeContextProvider, useRecipeContext } from "./context";
import RecipePageDesktop from "./recipe-page-desktop";
import RecipePageMobile from "./recipe-page-mobile";

type Props = {
  params: Promise<{ id: string }>;
};

function RecipePageContent({ recipeId }: { recipeId: string }) {
  const { recipe, isNotFound, isLoading } = useRecipeContext();
  const trpc = useTRPC();
  const { isQueryUnavailable } = useOfflineWeb();
  const unavailableOffline = isQueryUnavailable(trpc.recipes.get.queryKey({ id: recipeId }));
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
  if (!recipe && isNotFound) {
    return <NotFoundView message={t("notFoundMessage")} title={t("notFound")} />;
  }

  if (!recipe && unavailableOffline) {
    return <OfflineDataUnavailable />;
  }

  if (!recipe) {
    return <RecipeSkeleton />;
  }

  return (
    <>
      {/* Desktop layout - smooth fade in */}
      <div key={`${recipe?.id}-desktop`} className="fade-in hidden md:block">
        <RecipePageDesktop />
      </div>

      {/* Mobile layout - full width, smooth fade in */}
      <div
        key={`${recipe?.id}-mobile`}
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
        <RecipePageContent recipeId={id} />
      </WakeLockProvider>
    </RecipeContextProvider>
  );
}
