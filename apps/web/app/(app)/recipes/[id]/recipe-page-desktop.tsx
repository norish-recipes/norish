"use client";

import Link from "next/link";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import CookingMode from "@/app/(app)/recipes/[id]/components/cookingmode";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import AuthorChip from "@/components/recipes/author-chip";
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
import { useIngredientLinkHighlight } from "@/hooks/use-ingredient-link-highlight";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";
import StarRating from "@norish/ui/star-rating";

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
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);
  const { highlightedIngredientKey, highlightIngredient, ingredientListRef } =
    useIngredientLinkHighlight();

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <Link
          className="text-muted hover:text-foreground flex items-center gap-1 text-base no-underline"
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
          <Card className="rounded-2xl">
            <Card.Content className="space-y-5 p-6">
              <ReadonlyRecipeSummary
                actions={<ActionsMenu id={recipe.id} />}
                allergies={allergies}
                allergySet={allergySet}
                recipe={recipe}
              />
              <div className="pt-2">
                <CookingMode fullWidth />
              </div>
            </Card.Content>
          </Card>

          {/* Ingredients Card (separate) */}
          <Card className="rounded-2xl">
            <Card.Content className="space-y-4 p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <AmountDisplayToggle />
                  {recipe.servings && <ServingsControl />}
                  {recipe.systemUsed && <SystemConvertMenu />}
                </div>
              </div>

              <IngredientsList
                highlightedIngredientKey={highlightedIngredientKey}
                ingredientListRef={ingredientListRef}
              />

              {/* Add to groceries button */}
              <AddToGroceries recipeId={recipe.id} />
            </Card.Content>
          </Card>

          {/* Nutrition Card */}
          <NutritionCard />
        </div>

        {/* RIGHT column: Image + Steps (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-3">
          <DoubleTapContainer
            className="overflow-hidden rounded-2xl"
            doubleTapEnabled={showFavorites}
            onDoubleTap={() => {
              if (showFavorites) handleToggleFavorite();
            }}
          >
            <ReadonlyRecipeMedia
              className="h-[clamp(360px,42vw,520px)] rounded-2xl"
              mediaClassName="min-h-0"
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
            <Card className="rounded-2xl">
              <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
                <h2 className="text-lg font-semibold">{t("notes")}</h2>
              </Card.Header>
              <Card.Content className="p-6 pt-0">
                <ReadonlyRecipeNotes notes={recipe.notes} />
              </Card.Content>
            </Card>
          )}

          {/* Steps Card (below image in right column) */}
          <Card className="rounded-2xl">
            <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
            </Card.Header>
            <Card.Content className="px-3 pt-2 pb-0 text-left">
              <StepsList onIngredientPress={highlightIngredient} />
            </Card.Content>

            {/* Rating Section */}
            {showRatings && (
              <div className="bg-surface-secondary mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6">
                <p className="text-muted font-medium">{t("ratingPrompt")}</p>
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
