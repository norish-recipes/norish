"use client";

import { ActionButton } from "@/components/shared/action-button";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { FireIcon } from "@heroicons/react/20/solid";
import { Button, Card, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import StarRating from "@norish/ui/star-rating";

// Pieces both recipe skeletons draw. Controls are real but inert: nothing behind them has loaded.

/** Which optional parts a recipe skeleton draws. */
export type RecipeSkeletonParts = {
  showRatings: boolean;
  showNutrition: boolean;
  showFavorites: boolean;
  /** The app's own page: its back link, actions, cook and add-to-groceries buttons. */
  inApp: boolean;
};

/** Ingredient rows as the list draws them: the tick, the icon and the line. */
export function IngredientRowsSkeleton() {
  const { showIngredientIcons } = useHiddenItemVisibility();

  return (
    <div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          {showIngredientIcons && <Skeleton className="size-6 shrink-0 rounded-full md:size-8" />}
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** The real "Cook" button, inert. */
export function CookButtonPlaceholder({ className }: { className?: string }) {
  const t = useTranslations("recipes.detail");

  return (
    <div inert>
      <Button className={className} fullWidth={!className} variant="primary">
        <FireIcon className="size-5" />
        {t("cook")}
      </Button>
    </div>
  );
}

export function AddToGroceriesPlaceholder() {
  const tActions = useTranslations("common.actions");

  return (
    <div inert>
      <ActionButton fullWidth action="add">
        {tActions("add")}
      </ActionButton>
    </div>
  );
}

export function NutritionCardSkeleton() {
  const t = useTranslations("recipes.nutrition");

  return (
    <Card className="rounded-2xl" data-skeleton-part="nutrition">
      <Card.Content className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="flex items-center gap-5">
          <Skeleton className="size-32 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-16 rounded-md" />
                <Skeleton className="h-4 w-12 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}

/** The rating prompt and its stars, as the page draws them while the rating loads. */
export function RatingPlaceholder({ className }: { className: string }) {
  const t = useTranslations("recipes.detail");

  return (
    <div className={className} data-skeleton-part="rating">
      <p className="text-muted font-medium">{t("ratingPrompt")}</p>
      <StarRating isLoading value={null} onChange={() => {}} />
    </div>
  );
}
