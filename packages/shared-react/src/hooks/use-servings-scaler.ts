"use client";

import { useCallback, useMemo, useState } from "react";

type IngredientWithAmount = { amount?: number | string | null };

/** The ingredient at the chosen servings, its amount always a number. */
export type ScaledIngredient<T extends IngredientWithAmount> = Omit<T, "amount"> & {
  amount: number | null;
};

export type ServingsScalerResult<T extends IngredientWithAmount> = {
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
  const [servings, setServingsState] = useState<number>(
    Math.max(0.125, initialServings ?? originalServings)
  );

  const scaledIngredients = useMemo<ScaledIngredient<T>[]>(() => {
    if (ingredients.length === 0) {
      return [];
    }

    return ingredients.map((ing) => {
      const base = ing.amount === null || ing.amount === undefined ? NaN : Number(ing.amount);
      const amount = Number.isFinite(base) ? base : null;
      const scale =
        amount !== null && amount > 0 && originalServings > 0 && servings !== originalServings;

      return {
        ...ing,
        amount: scale ? Math.round((amount / originalServings) * servings * 10000) / 10000 : amount,
      };
    });
  }, [ingredients, servings, originalServings]);

  const setServings = useCallback((newServings: number) => {
    setServingsState(Math.max(0.125, newServings));
  }, []);

  const decrementServings = useCallback(() => {
    setServingsState((s) => {
      if (s <= 1) return Math.max(0.125, s / 2);
      if (s <= 2) return 1;

      return s - 1;
    });
  }, []);

  const incrementServings = useCallback(() => {
    setServingsState((s) => {
      if (s < 1) return Math.min(1, s * 2);

      return s + 1;
    });
  }, []);

  const resetToOriginal = useCallback(() => {
    setServingsState(Math.max(0.125, originalServings));
  }, [originalServings]);

  return {
    servings,
    scaledIngredients,
    setServings,
    incrementServings,
    decrementServings,
    resetToOriginal,
  };
}

export function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);

  return n.toFixed(2).replace(/\.?0+$/, "");
}
