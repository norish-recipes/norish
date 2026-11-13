"use client";

import { BackLink } from "@/components/page-transition";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import HeartButton from "@/components/shared/heart-button";
import {
  AmountDisplayToggle,
  AuthorChip,
  ReadonlyRecipeMedia,
  ReadonlyRecipeSummary,
} from "@/features/recipes/components/read-only";
import { useBackDestination } from "@/hooks/use-back-destination";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { LibraryTypeFilter } from "@norish/shared/contracts";
import { useActiveAllergies, useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useFavoritesMutation,
  useFavoritesQuery,
  useLoadedPageRecipe,
  useRatingQuery,
  useRatingsMutation,
} from "@norish/shared-react/recipes";
import StarRating from "@norish/ui/star-rating";

import ActionsMenu from "./actions-menu";
import AddToGroceries from "./add-to-groceries-button";
import CookbooksCard from "./cookbooks-card";
import CookingMode from "./cooking-mode/cooking-mode";
import IngredientsList from "./ingredient-list";
import NotesCard from "./notes-card";
import NutritionCard from "./nutrition-card";
import ProvenanceCard from "./provenance-card";
import ServingsControl from "./servings-control";
import StepsList from "./steps-list";
import SystemConvertMenu from "./system-convert-menu";

export default function RecipePageDesktop({
  libraryType,
  onPrint,
}: {
  libraryType: LibraryTypeFilter;
  onPrint: () => void;
}) {
  const recipe = useLoadedPageRecipe();
  const { allergies, allergySet } = useActiveAllergies();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();
  const t = useTranslations("recipes.detail");
  const back = useBackDestination(libraryType);
  const { showRatings, showFavorites } = useHiddenItemVisibility();

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number | null) => rateRecipe(recipe.id, rating);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <BackLink
          className="text-muted hover:text-foreground flex items-center gap-1 text-base no-underline"
          href={back.href}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {back.label}
        </BackLink>
      </div>

      {/* Main content grid: 2 columns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* LEFT column: Info card + Ingredients card (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-2">
          {/* Info Card */}
          <Card className="rounded-2xl">
            <Card.Content className="space-y-5 p-6">
              <ReadonlyRecipeSummary
                actions={<ActionsMenu id={recipe.id} onPrint={onPrint} />}
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
                  {recipe.servings > 0 && <ServingsControl />}
                  {recipe.systemUsed && <SystemConvertMenu />}
                </div>
              </div>

              <IngredientsList />

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

          {/* Recipe Provenance — above the notes, because where a dish comes
              from frames the cook's own notes about it. */}
          <ProvenanceCard />

          {/* Notes */}
          <NotesCard />

          {/* Steps Card (below image in right column) */}
          <Card className="rounded-2xl">
            <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
            </Card.Header>
            <Card.Content className="px-3 pt-2 pb-0 text-left">
              <StepsList />
            </Card.Content>

            {/* Rating Section */}
            {showRatings && (
              <div className="bg-surface-secondary mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6">
                <p className="text-muted font-medium">{t("ratingPrompt")}</p>
                <StarRating
                  allowClear={userRating !== null}
                  isLoading={isRating || isRatingLoading}
                  value={userRating ?? averageRating}
                  onChange={handleRateRecipe}
                />
              </div>
            )}
          </Card>

          {/* The cookbooks this recipe is filed into, last on the page. */}
          <CookbooksCard />
        </div>
      </div>
    </div>
  );
}
