import {
  MOBILE_RECIPE_MEDIA_HEIGHT_STYLE,
  RECIPE_HERO_CHROME_BUTTON_CLASS,
  RECIPE_HERO_CHROME_OFFSET_CLASS,
} from "@/components/recipes/recipe-layout-constants";
import { useFloatingDock } from "@/hooks/use-floating-dock";
import { ArrowLeftIcon, HeartIcon } from "@heroicons/react/16/solid";
import { AdjustmentsHorizontalIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Card, Skeleton } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  cssFloatingDockContentClearance,
  cssFloatingDockPill,
} from "@norish/web/config/css-tokens";

import type { RecipeSkeletonParts } from "./recipe-skeleton-parts";
import {
  AddToGroceriesPlaceholder,
  CookButtonPlaceholder,
  IngredientRowsSkeleton,
  NutritionCardSkeleton,
  RatingPlaceholder,
} from "./recipe-skeleton-parts";

/** The page's floating cook pill, where the page keeps it. */
function CookPillPlaceholder() {
  const dock = useFloatingDock({ align: "start", hideWithNav: true });

  return (
    <motion.div
      animate={dock.animate}
      className={`${dock.className} z-50`}
      style={dock.style}
      transition={dock.transition}
    >
      <CookButtonPlaceholder className={`shadow-xl ${cssFloatingDockPill}`} />
    </motion.div>
  );
}

/**
 * The phone page while it loads, without its optional cards and header lines;
 * {@link RecipeSkeleton} decides the parts.
 */
export default function RecipeSkeletonMobile({
  showRatings,
  showNutrition,
  showFavorites,
  inApp,
}: RecipeSkeletonParts) {
  const t = useTranslations("recipes.detail");

  return (
    <div
      className="flex w-full flex-col"
      style={inApp ? { marginTop: "calc(-1.5rem - env(safe-area-inset-top))" } : undefined}
    >
      {/* The hero as recipe-page-mobile.tsx draws it: edge to edge, fading into the page. */}
      <div className="relative w-full" style={{ height: MOBILE_RECIPE_MEDIA_HEIGHT_STYLE }}>
        <Skeleton className="h-full w-full rounded-none" />
        {inApp && (
          <>
            <div className={`absolute top-4 left-4 ${RECIPE_HERO_CHROME_OFFSET_CLASS}`}>
              <span className={RECIPE_HERO_CHROME_BUTTON_CLASS}>
                <ArrowLeftIcon />
              </span>
            </div>
            <div className={`absolute top-4 right-4 flex gap-2 ${RECIPE_HERO_CHROME_OFFSET_CLASS}`}>
              {showFavorites && (
                <span className={`${RECIPE_HERO_CHROME_BUTTON_CLASS} text-muted`}>
                  <HeartIcon />
                </span>
              )}
              <span className={RECIPE_HERO_CHROME_BUTTON_CLASS}>
                <EllipsisHorizontalIcon className="text-muted" />
              </span>
            </div>
          </>
        )}
        <div
          aria-hidden
          className="from-background via-background/45 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-20% via-55% to-transparent"
        />
      </div>

      <div
        className={`relative z-10 -mt-24 flex flex-col gap-4 px-4 ${inApp ? "" : "pb-6"}`}
        style={inApp ? { paddingBottom: cssFloatingDockContentClearance } : undefined}
      >
        <div className="flex justify-center py-0.5">
          <Skeleton className="h-8 w-3/4 rounded-lg" />
        </div>

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex shrink-0 items-center gap-1">
                <Skeleton className="h-8 w-28 rounded-full" />
                <span className="bg-surface-secondary text-muted flex size-8 items-center justify-center rounded-xl">
                  <AdjustmentsHorizontalIcon className="size-4" />
                </span>
              </div>
            </div>
            <IngredientRowsSkeleton />
            {inApp && <AddToGroceriesPlaceholder />}
          </Card.Content>
        </Card>

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">{t("steps")}</h2>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-3/4 rounded-md" />
                </div>
              </div>
            ))}
          </Card.Content>
        </Card>

        {showNutrition && <NutritionCardSkeleton />}

        {showRatings && (
          <Card className="rounded-2xl">
            <RatingPlaceholder className="flex flex-col items-center gap-4 p-5" />
          </Card>
        )}
      </div>

      {inApp && <CookPillPlaceholder />}
    </div>
  );
}
