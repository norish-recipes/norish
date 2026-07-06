"use client";

import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { useRecipeContextRequired } from "../context";

type ServingsControlProps = {
  compact?: boolean;
};

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);

  // Remove trailing zeros (e.g., 2.50 -> 2.5)
  return n.toFixed(2).replace(/\.?0+$/, "");
}
export default function ServingsControl({ compact = false }: ServingsControlProps) {
  const { currentServings, recipe, setIngredientAmounts } = useRecipeContextRequired();
  const servings = Math.max(0.125, currentServings ?? recipe.servings ?? 1);
  const buttonClassName = compact
    ? "bg-surface-secondary size-8 min-w-8 px-0"
    : "bg-surface-secondary";
  const valueClassName = compact
    ? "min-w-6 text-center text-xs tabular-nums"
    : "min-w-7 text-center text-sm tabular-nums";

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
    <div className={`inline-flex shrink-0 items-center ${compact ? "gap-1" : "gap-1.5"}`}>
      <Button
        isIconOnly
        aria-label="Decrease servings"
        className={buttonClassName}
        size="sm"
        onPress={dec}
        variant="tertiary"
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <span className={valueClassName}>{formatServings(servings)}</span>
      <Button
        isIconOnly
        aria-label="Increase servings"
        className={buttonClassName}
        size="sm"
        onPress={inc}
        variant="tertiary"
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
