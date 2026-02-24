"use client";

import { useCallback, useEffect, useState } from "react";

type IngredientWithAmount = { amount?: number | string | null };

export type ScaledIngredient<T extends IngredientWithAmount> = T & {
  originalAmount?: string | null;
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
  const [scaledIngredients, setScaledIngredients] = useState<ScaledIngredient<T>[]>([]);

  useEffect(() => {
    if (ingredients.length === 0) {
      setScaledIngredients([]);

      return;
    }

    const scaled = ingredients.map((ing) => {
      const baseAmount = ing.amount?.toString() ?? null;
      let displayAmount = baseAmount;

      if (baseAmount && originalServings > 0 && servings !== originalServings) {
        const amountNum = Number(baseAmount);

        if (!isNaN(amountNum) && amountNum > 0) {
          const scaledValue = Math.round((amountNum / originalServings) * servings * 10000) / 10000;

          displayAmount = scaledValue.toString();
        }
      }

      return {
        ...ing,
        amount: displayAmount,
        originalAmount: baseAmount,
      } as ScaledIngredient<T>;
    });

    setScaledIngredients(scaled);
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
