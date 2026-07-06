"use client";

import type { Ref } from "react";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import AmountDisplayToggle from "@/components/recipes/amount-display-toggle";
import { ReadonlyIngredientsList } from "@/components/recipes/readonly-ingredients-list";
import { ScrollShadow, Separator, Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookingModeDialogProps } from "./types";

type CookingIngredientsViewProps = Pick<
  CookingModeDialogProps,
  "displayIngredients" | "recipeServings" | "recipeSystemUsed" | "onPointerDown" | "onPointerUp"
> & {
  showTitle: boolean;
  highlightedIngredientKey?: string | null;
  ingredientListRef?: Ref<HTMLUListElement>;
};

export function CookingIngredientsView({
  displayIngredients,
  recipeServings,
  recipeSystemUsed,
  showTitle,
  highlightedIngredientKey,
  ingredientListRef,
  onPointerDown,
  onPointerUp,
}: CookingIngredientsViewProps) {
  const tCookMode = useTranslations("recipes.cookMode");

  return (
    <Tabs.Panel
      className="min-h-0 flex-1 overflow-hidden"
      id="ingredients"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 md:px-6 md:pt-5">
          {showTitle ? (
            <div className="min-w-0">
              <h3 className="text-lg font-semibold">{tCookMode("ingredients")}</h3>
              {recipeServings ? (
                <p className="text-muted text-sm">
                  {tCookMode("serving", { count: recipeServings })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto md:gap-2">
            <AmountDisplayToggle compact={!showTitle} />
            {recipeServings ? <ServingsControl compact={!showTitle} /> : null}
            {recipeSystemUsed ? <SystemConvertMenu compact={!showTitle} /> : null}
          </div>
        </div>
        <Separator className="mt-4" />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollShadow className="h-full px-4 py-4 md:px-6" size={64}>
            <ReadonlyIngredientsList
              interactive
              highlightedIngredientKey={highlightedIngredientKey}
              ingredientListRef={ingredientListRef}
              ingredients={displayIngredients}
              systemUsed={recipeSystemUsed}
            />
          </ScrollShadow>
        </div>
      </div>
    </Tabs.Panel>
  );
}
