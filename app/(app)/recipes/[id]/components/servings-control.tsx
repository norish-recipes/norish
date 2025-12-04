"use client";

import React, { useEffect, useCallback } from "react";
import { Button } from "@heroui/react";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";

import { useRecipeContextRequired } from "../context";

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Remove trailing zeros (e.g., 2.50 -> 2.5)
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export default function ServingsControl() {
  const { recipe, setIngredientAmounts } = useRecipeContextRequired();
  const [servings, setServings] = React.useState<number>(Math.max(0.125, recipe.servings ?? 1));

  const adjust = useCallback(
    (servingsValue: number) => {
      setIngredientAmounts(servingsValue);
    },
    [setIngredientAmounts]
  );

  useEffect(() => {
    if (recipe.recipeIngredients == null || recipe.recipeIngredients.length === 0) return;

    adjust(servings);
  }, [servings, adjust, recipe.recipeIngredients]);

  const dec = () =>
    setServings((s) => {
      // If at or below 1, halve it (1 -> 0.5 -> 0.25 -> 0.125)
      if (s <= 1) return Math.max(0.125, s / 2);
      // If between 1 and 2, go to 1
      if (s <= 2) return 1;
      // Otherwise decrement by 1
      return s - 1;
    });

  const inc = () =>
    setServings((s) => {
      // If below 1, double it (0.125 -> 0.25 -> 0.5 -> 1)
      if (s < 1) return Math.min(1, s * 2);
      // Otherwise increment by 1
      return s + 1;
    });

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        isIconOnly
        aria-label="Decrease servings"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={dec}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>
      <span className="min-w-8 text-center text-sm">{formatServings(servings)}</span>
      <Button
        isIconOnly
        aria-label="Increase servings"
        className="bg-content2"
        size="sm"
        variant="flat"
        onPress={inc}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
