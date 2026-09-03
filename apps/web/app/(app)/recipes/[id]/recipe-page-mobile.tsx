import Link from "next/link";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import CookbooksCard from "@/app/(app)/recipes/[id]/components/cookbooks-card";
import CookingMode from "@/app/(app)/recipes/[id]/components/cookingmode";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import IngredientsOptionsMenu from "@/app/(app)/recipes/[id]/components/ingredients-options-menu";
import NotesCard from "@/app/(app)/recipes/[id]/components/notes-card";
import NutritionCard from "@/app/(app)/recipes/[id]/components/nutrition-card";
import ProvenanceCard from "@/app/(app)/recipes/[id]/components/provenance-card";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import CookingTimeCard from "@/components/recipes/cooking-time-card";
import { ReadonlyRecipeMedia } from "@/components/recipes/readonly-recipe-sections";
import RecipeHeaderMobile from "@/components/recipes/recipe-header-mobile";
import {
  MOBILE_RECIPE_MEDIA_HEIGHT_STYLE,
  RECIPE_HERO_CHROME_BUTTON_CLASS,
  RECIPE_HERO_CHROME_OFFSET_CLASS,
} from "@/components/recipes/recipe-layout-constants";
import SourceCard from "@/components/recipes/source-card";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import HeartButton from "@/components/shared/heart-button";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import { useBackDestination } from "@/hooks/use-back-destination";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { ArrowLeftIcon } from "@heroicons/react/16/solid";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import StarRating from "@norish/ui/star-rating";
import { cssFloatingDockContentClearance } from "@norish/web/config/css-tokens";

import { useRecipeContextRequired } from "./context";

/**
 * The phone's recipe page: a header on the page background, then one card
 * per section in cooking order — Ingredients, Steps, Notes, Cooking Time,
 * Nutrition, Provenance, Source, Rating. The order is fixed and reader-owned ordering is out of
 * scope, so no reorder affordance is drawn. A section with nothing stored
 * and nothing running renders no card at all, which is what makes a bare
 * recipe a shorter page rather than a page of empty boxes.
 *
 * This reverses, on mobile only, what `recipe-page-desktop.tsx` still does —
 * Recipe Provenance ahead of the ingredients, because where a dish comes from
 * frames the recipe. On a phone the page follows the job instead, and
 * reference material comes after the cooking.
 */
export default function RecipePageMobile() {
  const { recipe, currentServings, allergies, allergySet } = useRecipeContextRequired();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();
  const t = useTranslations("recipes.detail");
  const back = useBackDestination();
  const { showRatings, showFavorites, showNutrition } = useHiddenItemVisibility();

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
        {/* The photo runs out rather than stopping: it dissolves into the
            page's own ground over its lower half, so the title reads as
            continuing the picture instead of sitting on a lid dropped over
            it. Drawn over the media rather than as a lightened image, so a
            video and a carousel fade the same way a still does. */}
        <DoubleTapContainer
          className="h-full w-full"
          doubleTapEnabled={showFavorites}
          onDoubleTap={() => {
            if (showFavorites) handleToggleFavorite();
          }}
        >
          {/* Chrome floats on the photo as real objects — surface, border and
              shadow — so the content below can start with the recipe rather
              than with navigation (ADR-0020). */}
          <ReadonlyRecipeMedia
            aspectRatio="4/3"
            className="h-full rounded-none shadow-none"
            recipe={recipe}
            rounded={false}
            showAuthorFallback={false}
            topLeftContent={
              <Link
                aria-label={back.label}
                className={`${RECIPE_HERO_CHROME_OFFSET_CLASS} ${RECIPE_HERO_CHROME_BUTTON_CLASS} no-underline`}
                href={back.href}
              >
                <ArrowLeftIcon className="size-5" />
              </Link>
            }
            topRightContent={
              <div className={`${RECIPE_HERO_CHROME_OFFSET_CLASS} flex items-center gap-2`}>
                {showFavorites && (
                  <HeartButton
                    showBackground
                    className={RECIPE_HERO_CHROME_BUTTON_CLASS}
                    isFavorite={isFavorite}
                    size="lg"
                    onToggle={handleToggleFavorite}
                  />
                )}
                <ActionsMenu buttonClassName={RECIPE_HERO_CHROME_BUTTON_CLASS} id={recipe.id} />
              </div>
            }
          />
        </DoubleTapContainer>

        <div
          aria-hidden
          className="from-background via-background/45 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-20% via-55% to-transparent"
        />
      </div>

      {/* The header sits in the tail of that fade, on the page background;
          only the sections below it are cards. The trailing padding clears the
          floating cook pill, so the last card is never hidden behind it —
          read off the row's own geometry rather than guessed, because a guess
          stops clearing the pill on a phone with a home indicator. */}
      <div
        className="relative z-10 -mt-24 flex flex-col gap-4 px-4"
        style={{ paddingBottom: cssFloatingDockContentClearance }}
      >
        {/* The Glance Bar restates what the sections below render, so it reads
            the servings the ingredients are actually scaled to rather than the
            stored figure — a bar disagreeing with the row under it is exactly
            the bug a restating bar invites. */}
        <RecipeHeaderMobile
          allergies={allergies}
          allergySet={allergySet}
          recipe={{ ...recipe, servings: currentServings ?? recipe.servings }}
          showCalories={showNutrition}
        />

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5">
            {/* The same header shape the Nutrition card uses: the heading, the
                stepper that scales what is under it, and the options that act
                on it. Fractions-versus-decimals and the measurement system are
                reached from the list rather than from the page's `⋯` menu,
                because the list is what they change. */}
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex shrink-0 items-center gap-1">
                {recipe.servings ? <ServingsControl /> : null}
                <IngredientsOptionsMenu />
              </div>
            </div>

            <IngredientsList />

            <AddToGroceries recipeId={recipe.id} />
          </Card.Content>
        </Card>

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5 text-left">
            <h2 className="text-lg font-semibold">{t("steps")}</h2>
            <StepsList />
          </Card.Content>
        </Card>

        <NotesCard />

        <CookingTimeCard recipe={recipe} />

        <NutritionCard />

        <ProvenanceCard />

        <SourceCard recipe={recipe} />

        {/* The cookbooks this recipe is filed into, last on the page. */}
        <CookbooksCard />

        {showRatings && (
          <Card className="rounded-2xl">
            <Card.Content className="flex flex-col items-center gap-4 p-5">
              <p className="text-muted font-medium">{t("ratingPrompt")}</p>
              <StarRating
                isLoading={isRating || isRatingLoading}
                value={userRating ?? averageRating}
                onChange={handleRateRecipe}
              />
            </Card.Content>
          </Card>
        )}
      </div>

      {/* Out of the content flow entirely, so it never scrolls away. */}
      <CookingMode floating />
    </div>
  );
}
