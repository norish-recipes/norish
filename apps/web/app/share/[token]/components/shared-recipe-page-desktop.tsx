"use client";

import { ReadonlyNutritionCard } from "@/components/recipes/readonly-nutrition";
import {
  ReadonlyRecipeMedia,
  ReadonlyRecipeNotes,
  ReadonlyRecipeSummary,
} from "@/components/recipes/readonly-recipe-sections";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import { usePublicRecipeContext } from "../public/public-recipe-context";
import { ShareRecipeControls } from "./share-recipe-controls";
import { ShareRecipeIngredients } from "./share-recipe-ingredients";
import { ShareRecipeSteps } from "./share-recipe-steps";

export function SharedRecipePageDesktop() {
  const t = useTranslations("recipes.detail");
  const { recipe } = usePublicRecipeContext();

  return (
    <div className="hidden flex-col space-y-6 px-6 pt-6 pb-10 md:flex">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-2">
          <Card className="bg-surface rounded-2xl shadow-md">
            <Card.Content className="p-6">
              <ReadonlyRecipeSummary recipe={recipe} />
            </Card.Content>
          </Card>

          <Card className="bg-surface rounded-2xl shadow-md">
            <Card.Content className="space-y-4 p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <ShareRecipeControls />
                </div>
              </div>
              <ShareRecipeIngredients />
            </Card.Content>
          </Card>

          <ReadonlyNutritionCard recipe={recipe} />
        </div>

        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-3">
          <ReadonlyRecipeMedia rounded recipe={recipe} />

          {recipe.notes && (
            <Card className="bg-surface rounded-2xl shadow-md">
              <Card.Header className="px-6 pt-6">
                <h2 className="text-lg font-semibold">{t("notes")}</h2>
              </Card.Header>
              <Card.Content className="p-6 pt-0">
                <ReadonlyRecipeNotes notes={recipe.notes} />
              </Card.Content>
            </Card>
          )}

          <Card className="bg-surface rounded-2xl shadow-md">
            <Card.Header className="px-6 pt-6">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
            </Card.Header>
            <Card.Content className="px-3 pt-2 pb-4">
              <ShareRecipeSteps />
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}
