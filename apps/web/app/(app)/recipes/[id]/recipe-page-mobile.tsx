import { useEffect, useMemo, useState } from "react";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import AmountDisplayToggle from "@/app/(app)/recipes/[id]/components/amount-display-toggle";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { MOBILE_RECIPE_MEDIA_HEIGHT_STYLE } from "@/app/(app)/recipes/[id]/recipe-layout-constants";
import { NutritionSection } from "@/components/recipes/nutrition-card";
import {
  ReadonlyRecipeMedia,
  ReadonlyRecipeNotes,
  ReadonlyRecipeSummary,
} from "@/components/recipes/readonly-recipe-sections";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import HeartButton from "@/components/shared/heart-button";
import { useUserContext } from "@/context/user-context";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  CakeIcon,
  ClockIcon,
  FireIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/16/solid";
import { Card, CardBody, Chip, Divider, Link } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  formatMinutesHM,
  isAllergenTag,
  sortTagsWithAllergyPriority,
} from "@norish/shared/lib/helpers";
import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";
import StarRating from "@norish/ui/star-rating";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";

export default function RecipePageMobile() {
  const {
    recipe,
    currentServings: _currentServings,
    allergies,
    allergySet,
  } = useRecipeContextRequired();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();
  const { user } = useUserContext();
  const t = useTranslations("recipes.detail");
  const tForm = useTranslations("recipes.form");
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  return (
    <div
      className="flex w-full flex-col"
      style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}
    >
      {/* Hero Image/Video Carousel */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: MOBILE_RECIPE_MEDIA_HEIGHT_STYLE }}
      >
        <DoubleTapContainer
          className="h-full w-full"
          doubleTapEnabled={showFavorites}
          onDoubleTap={() => {
            if (showFavorites) handleToggleFavorite();
          }}
        >
          <ReadonlyRecipeMedia
            aspectRatio="4/3"
            className="h-full rounded-none shadow-none"
            recipe={recipe}
            rounded={false}
            topLeftContent={
              recipe?.author ? (
                <div className="mt-[calc(2.75rem+env(safe-area-inset-top))]">
                  <AuthorChip
                    image={recipe.author.image}
                    name={recipe.author.name}
                    userId={recipe.author.id}
                  />
                </div>
              ) : null
            }
            bottomRightContent={
              showFavorites ? (
                <HeartButton
                  showBackground
                  isFavorite={isFavorite}
                  size="lg"
                  onToggle={handleToggleFavorite}
                />
              ) : null
            }
          />
        </DoubleTapContainer>
      </div>

      {/* Unified Content Card - contains all sections */}
      <Card
        className="bg-content1 relative z-10 -mt-6 overflow-visible rounded-t-3xl"
        radius="none"
        shadow="sm"
      >
        <CardBody className="space-y-6 px-4 py-5">
          {/* Back link and Actions */}
          <div className="flex items-center justify-between">
            <div className="w-fit hover:underline">
              <Link className="text-default-500 flex items-center gap-1 text-base" href="/">
                <ArrowLeftIcon className="h-4 w-4" />
                {t("backToRecipes")}
              </Link>
            </div>
            <div className="flex-shrink-0">
              <ActionsMenu id={recipe.id} />
            </div>
          </div>

          <ReadonlyRecipeSummary
            actions={<ActionsMenu id={recipe.id} />}
            allergies={allergies}
            allergySet={allergySet}
            recipe={recipe}
            timeVariant="mobile"
          />

          <Divider />

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex items-center gap-2">
                <AmountDisplayToggle />
                <ServingsControl />
                {recipe.systemUsed && <SystemConvertMenu />}
              </div>
            </div>

            <div className="-mx-1">
              <IngredientsList />
            </div>

            {/* Add to groceries button - below ingredients */}
            <AddToGroceries recipeId={recipe.id} />
          </div>

          <Divider />

          {/* Notes */}
          {recipe.notes && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("notes")}</h2>
                </div>
                <div>
                  <ReadonlyRecipeNotes notes={recipe.notes} />
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
              <WakeLockToggle />
            </div>

            <div className="-mx-1">
              <StepsList />
            </div>

            {/* Rating Section */}
            {showRatings && (
              <div className="bg-default-100 -mx-1 flex flex-col items-center gap-4 rounded-xl py-6">
                <p className="text-default-600 font-medium">{t("ratingPrompt")}</p>
                <StarRating
                  isLoading={isRating || isRatingLoading}
                  value={userRating ?? averageRating}
                  onChange={handleRateRecipe}
                />
              </div>
            )}
          </div>

          {/* Nutrition Section */}
          <NutritionSection />
        </CardBody>
      </Card>

      <div className="pb-5" />
    </div>
  );
}
