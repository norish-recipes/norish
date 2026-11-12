"use client";

import { useCallback, useMemo, useState } from "react";

import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

import { scaleIngredients } from "./scale-ingredients";
import { MIN_SERVINGS, servingsDown, servingsUp } from "./servings";

type IngredientWithAmount = { amount?: number | string | null };

/** The ingredient at the chosen servings, its amount always a number. */
export type ScaledIngredient<T extends IngredientWithAmount> = Omit<T, "amount"> & {
  amount: number | null;
};

type ServingsScalerResult<T extends IngredientWithAmount> = {
  servings: number;
  scaledIngredients: ScaledIngredient<T>[];
  setServings: (servings: number) => void;
  incrementServings: () => void;
  decrementServings: () => void;
  resetToOriginal: () => void;
};

export function useServingsScaler<T extends IngredientWithAmount>(
  ingredients: T[],
  originalServings: number,
  initialServings?: number
): ServingsScalerResult<T> {
  const [servings, setServings] = useState<number>(
    Math.max(MIN_SERVINGS, initialServings ?? originalServings)
  );

  const scaledIngredients = useMemo<ScaledIngredient<T>[]>(() => {
    // Amounts as numbers even unscaled: the groceries panel formats them with toFixed.
    const lines = ingredients.map((ing) => {
      const base = ing.amount === null || ing.amount === undefined ? NaN : Number(ing.amount);

      return { ...ing, amount: Number.isFinite(base) ? base : null };
    });

    return scaleIngredients(lines, originalServings, servings);
  }, [ingredients, servings, originalServings]);

  const setClampedServings = useCallback((newServings: number) => {
    setServings(Math.max(MIN_SERVINGS, newServings));
  }, []);

  const decrementServings = useCallback(() => setServings(servingsDown), []);

  const incrementServings = useCallback(() => setServings(servingsUp), []);

  const resetToOriginal = useCallback(() => {
    setServings(Math.max(MIN_SERVINGS, originalServings));
  }, [originalServings]);

  return {
    servings,
    scaledIngredients,
    setServings: setClampedServings,
    incrementServings,
    decrementServings,
    resetToOriginal,
  };
}

export function formatServings(n: number): string {
  return formatAmountAsDecimal(n);
}
