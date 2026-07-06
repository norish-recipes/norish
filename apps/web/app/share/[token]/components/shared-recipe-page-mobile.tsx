"use client";

import AuthorChip from "@/components/recipes/author-chip";
import { ReadonlyNutritionSection } from "@/components/recipes/readonly-nutrition";
import {
  ReadonlyRecipeMedia,
  ReadonlyRecipeNotes,
  ReadonlyRecipeSummary,
} from "@/components/recipes/readonly-recipe-sections";
import { MOBILE_RECIPE_MEDIA_HEIGHT_STYLE } from "@/components/recipes/recipe-layout-constants";
import AuthLanguageSelector from "@/components/shared/auth-language-selector";
import { Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import { usePublicRecipeContext } from "../public/public-recipe-context";
import { ShareRecipeControls } from "./share-recipe-controls";
import { ShareRecipeIngredients } from "./share-recipe-ingredients";
import { ShareRecipeSteps } from "./share-recipe-steps";

export function SharedRecipePageMobile() {
  const t = useTranslations("recipes.detail");
  const { recipe } = usePublicRecipeContext();

  return (
    <div className="-mx-4 -mt-4 flex w-[calc(100%+2rem)] flex-col md:hidden">
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: MOBILE_RECIPE_MEDIA_HEIGHT_STYLE,
        }}
      >
        <ReadonlyRecipeMedia
          aspectRatio="4/3"
          className="h-full rounded-none shadow-none"
          recipe={recipe}
          rounded={false}
          topLeftContent={
            recipe.author ? (
              <div className="mt-2">
                <AuthorChip image={recipe.author.image} name={recipe.author.name} />
              </div>
            ) : null
          }
          topRightContent={
            <div className="mt-2">
              <AuthLanguageSelector />
            </div>
          }
        />
      </div>

      <Card className="bg-surface relative z-10 -mt-6 overflow-visible rounded-t-3xl rounded-b-none shadow-sm">
        <Card.Content className="space-y-6 px-4 py-5">
          <ReadonlyRecipeSummary recipe={recipe} timeVariant="mobile" />

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex items-center gap-2">
                <ShareRecipeControls />
              </div>
            </div>
            <div className="-mx-1">
              <ShareRecipeIngredients />
            </div>
          </div>

          {recipe.notes && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">{t("notes")}</h2>
                <ReadonlyRecipeNotes notes={recipe.notes} />
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t("steps")}</h2>
            <div className="-mx-1">
              <ShareRecipeSteps />
            </div>
          </div>

          <ReadonlyNutritionSection recipe={recipe} />
        </Card.Content>
      </Card>

      <div className="pb-5" />
    </div>
  );
}
