import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import CookingMode from "@/app/(app)/recipes/[id]/components/cookingmode";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import { NutritionSection } from "@/app/(app)/recipes/[id]/components/nutrition-card";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import AuthorChip from "@/components/recipes/author-chip";
import {
  ReadonlyRecipeMedia,
  ReadonlyRecipeNotes,
  ReadonlyRecipeSummary,
} from "@/components/recipes/readonly-recipe-sections";
import { MOBILE_RECIPE_MEDIA_HEIGHT_STYLE } from "@/components/recipes/recipe-layout-constants";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import HeartButton from "@/components/shared/heart-button";
import { useUserContext } from "@/context/user-context";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import { useIngredientLinkHighlight } from "@/hooks/use-ingredient-link-highlight";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { Card, Link, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";
import StarRating from "@norish/ui/star-rating";

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
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);
  const { highlightedIngredientKey, highlightIngredient, ingredientListRef } =
    useIngredientLinkHighlight();

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
            topRightContent={
              showFavorites ? (
                <div className="mt-[calc(2.75rem+env(safe-area-inset-top))]">
                  <HeartButton
                    showBackground
                    isFavorite={isFavorite}
                    size="lg"
                    onToggle={handleToggleFavorite}
                  />
                </div>
              ) : null
            }
          />
        </DoubleTapContainer>
      </div>

      {/* Unified Content Card - contains all sections */}
      <Card className="relative z-10 -mt-6 overflow-visible rounded-t-3xl rounded-b-none border-0 shadow-none">
        <Card.Content className="space-y-6 px-4 py-5">
          {/* Back link and Actions */}
          <div className="flex items-center justify-between">
            <div className="w-fit">
              <Link
                className="text-muted hover:text-foreground flex items-center gap-1 text-base no-underline"
                href="/"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                {t("backToRecipes")}
              </Link>
            </div>
            <div className="flex-shrink-0">
              <ActionsMenu id={recipe.id} />
            </div>
          </div>

          <ReadonlyRecipeSummary
            allergies={allergies}
            allergySet={allergySet}
            recipe={recipe}
            timeVariant="mobile"
          />

          <CookingMode fullWidth />

          <Separator />

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto">
                <AmountDisplayToggle compact />
                {recipe.servings ? <ServingsControl compact /> : null}
                {recipe.systemUsed && <SystemConvertMenu compact />}
              </div>
            </div>

            <IngredientsList
              highlightedIngredientKey={highlightedIngredientKey}
              ingredientListRef={ingredientListRef}
            />

            {/* Add to groceries button - below ingredients */}
            <AddToGroceries recipeId={recipe.id} />
          </div>

          <Separator />

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
              <Separator />
            </>
          )}

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex flex-row items-center justify-between text-left">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
            </div>

            <div className="text-left">
              <StepsList onIngredientPress={highlightIngredient} />
            </div>

            {/* Rating Section */}
            {showRatings && (
              <div className="bg-surface-secondary flex flex-col items-center gap-4 rounded-xl py-6">
                <p className="text-muted font-medium">{t("ratingPrompt")}</p>
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
        </Card.Content>
      </Card>

      <div className="pb-5" />
    </div>
  );
}
