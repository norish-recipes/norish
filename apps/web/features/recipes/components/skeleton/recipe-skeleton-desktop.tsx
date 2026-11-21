import { ArrowLeftIcon, HeartIcon } from "@heroicons/react/16/solid";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Card, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeSkeletonParts } from "./recipe-skeleton-parts";
import {
  AddToGroceriesPlaceholder,
  CookButtonPlaceholder,
  IngredientRowsSkeleton,
  NutritionCardSkeleton,
  RatingPlaceholder,
} from "./recipe-skeleton-parts";

/**
 * The desktop page while it loads, without its optional cards;
 * {@link RecipeSkeleton} decides the parts.
 */
export default function RecipeSkeletonDesktop({
  showRatings,
  showNutrition,
  showFavorites,
  inApp,
}: RecipeSkeletonParts) {
  const t = useTranslations("recipes.detail");

  return (
    <div className={`hidden flex-col space-y-6 px-6 pb-10 md:flex ${inApp ? "" : "pt-6"}`}>
      {inApp && (
        <div className="text-muted flex h-6 w-fit items-center gap-1">
          <ArrowLeftIcon className="h-4 w-4" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-2">
          <Card className="rounded-2xl">
            <Card.Content className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <Skeleton className="h-8 w-3/4 rounded-lg" />
                {inApp && (
                  <span className="text-muted flex size-8 shrink-0 items-center justify-center">
                    <EllipsisHorizontalIcon className="h-5 w-5" />
                  </span>
                )}
              </div>
              {inApp && (
                <div className="pt-2">
                  <CookButtonPlaceholder />
                </div>
              )}
            </Card.Content>
          </Card>

          <Card className="rounded-2xl">
            <Card.Content className="space-y-4 p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="h-8 w-14 rounded-full" />
                </div>
              </div>
              <IngredientRowsSkeleton />
              {inApp && <AddToGroceriesPlaceholder />}
            </Card.Content>
          </Card>

          {showNutrition && <NutritionCardSkeleton />}
        </div>

        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-3">
          <div className="relative">
            <Skeleton className="h-[clamp(360px,42vw,520px)] w-full rounded-2xl" />
            {showFavorites && (
              <span className="bg-surface text-muted absolute top-4 right-4 flex size-10 items-center justify-center rounded-full shadow-md">
                <HeartIcon className="size-5" />
              </span>
            )}
          </div>

          <Card className="rounded-2xl">
            <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
            </Card.Header>
            <Card.Content className="space-y-4 px-3 pt-2 pb-0">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-4 px-3 py-2">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                </div>
              ))}
            </Card.Content>
            {showRatings && (
              <RatingPlaceholder className="bg-surface-secondary mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
