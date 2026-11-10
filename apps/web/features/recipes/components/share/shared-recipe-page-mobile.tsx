"use client";

import AuthLanguageSelector from "@/components/shared/auth-language-selector";
import CookingTimeCard from "@/features/recipes/components/read-only/cooking-time-card";
import { ReadonlyNutritionCard } from "@/features/recipes/components/read-only/readonly-nutrition";
import {
  ReadonlyRecipeMedia,
  ReadonlyRecipeNotes,
} from "@/features/recipes/components/read-only/readonly-recipe-sections";
import RecipeHeaderMobile from "@/features/recipes/components/read-only/recipe-header-mobile";
import SourceCard from "@/features/recipes/components/read-only/source-card";
import { MOBILE_RECIPE_MEDIA_HEIGHT_STYLE } from "@/features/recipes/lib/recipe-layout-constants";
import { useSharedRecipe, useShareServings } from "@/features/recipes/stores/share-page-store";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ShareRecipeControls } from "./share-recipe-controls";
import { ShareRecipeIngredients } from "./share-recipe-ingredients";
import { ShareRecipeSteps } from "./share-recipe-steps";

/**
 * The share page's phone layout, deliberately the app's own (ticket 12): the
 * photo runs edge to edge and dissolves into the page ground, the shared
 * header and Glance Bar sit on that ground, and each section is a card in
 * cooking order — Ingredients, Steps, Notes, Cooking Time, Nutrition,
 * Source. What a signed-out reader has no business with simply is not here:
 * no favourites, rating, provenance, actions menu or cook button. There are
 * no Hidden Items either, so everything the recipe stores is shown.
 */
export function SharedRecipePageMobile() {
  const t = useTranslations("recipes.detail");
  const recipe = useSharedRecipe();

  return (
    <div className="-mx-4 -mt-4 flex w-[calc(100%+2rem)] flex-col md:hidden">
      <div
        className="relative w-full overflow-hidden"
        style={{ height: MOBILE_RECIPE_MEDIA_HEIGHT_STYLE }}
      >
        <ReadonlyRecipeMedia
          aspectRatio="4/3"
          chromeClassName="mt-2"
          className="h-full rounded-none shadow-none"
          expandControlSlot="topLeft"
          recipe={recipe}
          rounded={false}
          showAuthorFallback={false}
          topRightContent={<AuthLanguageSelector />}
        />

        {/* The same dissolve the app's page draws: the photo runs out into
            the page ground rather than stopping at a card's edge. */}
        <div
          aria-hidden
          className="from-background via-background/45 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-20% via-55% to-transparent"
        />
      </div>

      <div className="relative z-10 -mt-24 flex flex-col gap-4 px-4 pb-6">
        {/* The Glance Bar restates what the sections render, so it reads the
            servings the ingredients are actually scaled to. */}
        <ShareRecipeHeader />

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex shrink-0 items-center gap-2">
                <ShareRecipeControls />
              </div>
            </div>

            <ShareRecipeIngredients />
          </Card.Content>
        </Card>

        <Card className="rounded-2xl">
          <Card.Content className="space-y-4 p-5 text-left">
            <h2 className="text-lg font-semibold">{t("steps")}</h2>
            <ShareRecipeSteps />
          </Card.Content>
        </Card>

        {recipe.notes && (
          <Card className="rounded-2xl">
            <Card.Content className="space-y-4 p-5">
              <h2 className="text-lg font-semibold">{t("notes")}</h2>
              <ReadonlyRecipeNotes notes={recipe.notes} />
            </Card.Content>
          </Card>
        )}

        <CookingTimeCard recipe={recipe} />

        <ReadonlyNutritionCard recipe={recipe} />

        <SourceCard recipe={recipe} />
      </div>
    </div>
  );
}

/** The Glance Bar, apart from the page, so a change of servings renders only it. */
function ShareRecipeHeader() {
  const recipe = useSharedRecipe();
  const servings = useShareServings();

  return <RecipeHeaderMobile recipe={{ ...recipe, servings }} />;
}
