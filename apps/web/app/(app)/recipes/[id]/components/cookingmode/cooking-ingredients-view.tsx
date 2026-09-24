"use client";

import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { ScrollShadow, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookingModeDialogProps } from "./types";

type CookingIngredientsViewProps = Pick<
  CookingModeDialogProps,
  "displayIngredients" | "recipe" | "checkedIngredients" | "onCheckedIngredientsChange"
> & {
  showTitle: boolean;
};

export function CookingIngredientsView({
  displayIngredients,
  recipe,
  showTitle,
  checkedIngredients,
  onCheckedIngredientsChange,
}: CookingIngredientsViewProps) {
  const tCookMode = useTranslations("recipes.cookMode");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
        {showTitle ? (
          <div className="min-w-0">
            <h3 className="text-lg font-semibold">{tCookMode("ingredients")}</h3>
            {recipe.servings ? (
              <p className="text-muted text-sm">
                {tCookMode("serving", { count: recipe.servings })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto md:gap-2">
          <AmountDisplayToggle compact={!showTitle} />
          {recipe.servings ? <ServingsControl compact={!showTitle} /> : null}
          {recipe.systemUsed ? <SystemConvertMenu compact={!showTitle} /> : null}
        </div>
      </div>
      <Separator className="mt-4" />
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollShadow className="h-full px-4 py-4 md:px-6" size={64}>
          <ReadonlyIngredientsList
            interactive
            checkedIndices={checkedIngredients}
            ingredients={displayIngredients}
            systemUsed={recipe.systemUsed}
            onCheckedIndicesChange={onCheckedIngredientsChange}
          />
        </ScrollShadow>
      </div>
    </div>
  );
}
