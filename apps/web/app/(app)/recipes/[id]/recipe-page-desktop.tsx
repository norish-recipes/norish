"use client";

import Link from "next/link";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import NutritionCard from "@/components/recipes/nutrition-card";
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
  WrenchScrewdriverIcon,
} from "@heroicons/react/16/solid";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
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

import AmountDisplayToggle from "./components/amount-display-toggle";
import AuthorChip from "./components/author-chip";
import ServingsControl from "./components/servings-control";
import { useRecipeContextRequired } from "./context";

export default function RecipePageDesktop() {
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
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <Link
          className="text-default-500 flex items-center gap-1 text-base hover:underline"
          href="/"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToRecipes")}
        </Link>
      </div>

      {/* Main content grid: 2 columns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* LEFT column: Info card + Ingredients card (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-2">
          {/* Info Card */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardBody className="p-6">
              <ReadonlyRecipeSummary
                actions={<ActionsMenu id={recipe.id} />}
                allergies={allergies}
                allergySet={allergySet}
                recipe={recipe}
              />
            </CardBody>
          </Card>

          {/* Ingredients Card (separate) */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardBody className="space-y-4 p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <AmountDisplayToggle />
                  {recipe.servings && <ServingsControl />}
                  {recipe.systemUsed && <SystemConvertMenu />}
                </div>
              </div>

              <IngredientsList />

              {/* Add to groceries button */}
              <AddToGroceries recipeId={recipe.id} />
            </CardBody>
          </Card>

          {/* Nutrition Card */}
          <NutritionCard />
        </div>

        {/* RIGHT column: Image + Steps (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-3">
          <DoubleTapContainer
            doubleTapEnabled={showFavorites}
            onDoubleTap={() => {
              if (showFavorites) handleToggleFavorite();
            }}
          >
            <ReadonlyRecipeMedia
              recipe={recipe}
              topLeftContent={
                recipe.author ? (
                  <AuthorChip
                    image={recipe.author.image}
                    name={recipe.author.name}
                    userId={recipe.author.id}
                  />
                ) : null
              }
              topRightContent={
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

          {/* Notes */}
          {recipe.notes && (
            <Card className="bg-content1 rounded-2xl shadow-md">
              <CardHeader className="flex items-center justify-between px-6 pt-6">
                <h2 className="text-lg font-semibold">{t("notes")}</h2>
              </CardHeader>
              <CardBody className="p-6 pt-0">
                <ReadonlyRecipeNotes notes={recipe.notes} />
              </CardBody>
            </Card>
          )}

          {/* Steps Card (below image in right column) */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardHeader className="flex items-center justify-between px-6 pt-6">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
              <WakeLockToggle />
            </CardHeader>
            <CardBody className="px-3 pt-2 pb-0">
              <StepsList />
            </CardBody>

            {/* Rating Section */}
            {showRatings && (
              <div className="bg-default-100 mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6">
                <p className="text-default-600 font-medium">{t("ratingPrompt")}</p>
                <StarRating
                  isLoading={isRating || isRatingLoading}
                  value={userRating ?? averageRating}
                  onChange={handleRateRecipe}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
