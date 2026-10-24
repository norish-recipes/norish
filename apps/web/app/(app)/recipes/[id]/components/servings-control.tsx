"use client";

import { AnimatedNumber } from "@/components/recipes/animated-number";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

import { useRecipeContextRequired } from "../context";

type ServingsControlProps = {
  compact?: boolean;
};

/**
 * Servings, as the same stepper the Nutrition card uses for portions: the two
 * do the same job on the same page, and drawing them differently says they do
 * not. It sits inline with the Ingredients heading rather than as a row of its
 * own, so the card starts with the list.
 */
export default function ServingsControl({ compact = false }: ServingsControlProps) {
  const { currentServings, recipe, setIngredientAmounts } = useRecipeContextRequired();
  const t = useTranslations("recipes.detail");
  const servings = Math.max(0.125, currentServings ?? recipe.servings ?? 1);
  const buttonClassName = compact
    ? "bg-surface-secondary size-8 min-w-8 px-0"
    : "bg-surface-secondary";
  const valueClassName = compact
    ? "min-w-6 justify-center text-xs"
    : "min-w-8 justify-center text-sm";

  const dec = () => {
    if (servings <= 1) {
      setIngredientAmounts(Math.max(0.125, servings / 2));

      return;
    }

    if (servings <= 2) {
      setIngredientAmounts(1);

      return;
    }

    setIngredientAmounts(servings - 1);
  };
  const inc = () => {
    if (servings < 1) {
      setIngredientAmounts(Math.min(1, servings * 2));

      return;
    }

    setIngredientAmounts(servings + 1);
  };

  return (
    <div className={`inline-flex shrink-0 items-center ${compact ? "gap-1" : "gap-2"}`}>
      <Button
        isIconOnly
        aria-label={t("decreaseServings")}
        className={buttonClassName}
        size="sm"
        variant="tertiary"
        onPress={dec}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>

      {/* Only the figure rolls. Rolling the word beside it would animate
          something that did not change. */}
      <span className="sr-only">{t("servingsCount", { count: servings })}</span>
      <AnimatedNumber className={valueClassName} value={formatAmountAsDecimal(servings)} />

      <Button
        isIconOnly
        aria-label={t("increaseServings")}
        className={buttonClassName}
        size="sm"
        variant="tertiary"
        onPress={inc}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
