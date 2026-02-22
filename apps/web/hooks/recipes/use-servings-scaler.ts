"use client";

import { useState, useEffect, useCallback } from "react";

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

/**
 * Hook for scaling recipe ingredient amounts based on servings.
 *
 * @param ingredients - Array of ingredients from the recipe
 * @param originalServings - The base servings count from the recipe definition
 * @param initialServings - The initial servings to display (defaults to originalServings)
 * @returns Scaled ingredients and servings control functions
 */
export function useServingsScaler<T extends IngredientWithAmount>(
  ingredients: T[],
  originalServings: number,
  initialServings?: number
): ServingsScalerResult<T> {
  const [servings, setServingsState] = useState<number>(
    Math.max(0.125, initialServings ?? originalServings)
  );
  const [scaledIngredients, setScaledIngredients] = useState<ScaledIngredient<T>[]>([]);

  // Single effect to handle both initialization and scaling
  useEffect(() => {
    if (ingredients.length === 0) {
      setScaledIngredients([]);

      return;
    }

    const scaled = ingredients.map((ing) => {
      const baseAmount = ing.amount?.toString() ?? null;
      let displayAmount = baseAmount;

      // Scale to current servings for display
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
        originalAmount: baseAmount, // Store base recipe amount for recalculation
      } as ScaledIngredient<T>;
    });

    setScaledIngredients(scaled);
  }, [ingredients, servings, originalServings]);

  const setServings = useCallback((newServings: number) => {
    setServingsState(Math.max(0.125, newServings));
  }, []);

  const decrementServings = useCallback(() => {
    setServingsState((s) => {
      // If at or below 1, halve it (1 -> 0.5 -> 0.25 -> 0.125)
      if (s <= 1) return Math.max(0.125, s / 2);
      // If between 1 and 2, go to 1
      if (s <= 2) return 1;

      // Otherwise decrement by 1
      return s - 1;
    });
  }, []);

  const incrementServings = useCallback(() => {
    setServingsState((s) => {
      // If below 1, double it (0.125 -> 0.25 -> 0.5 -> 1)
      if (s < 1) return Math.min(1, s * 2);

      // Otherwise increment by 1
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

/**
 * Format servings number for display
 */
export function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);

  // Remove trailing zeros (e.g., 2.50 -> 2.5)
  return n.toFixed(2).replace(/\.?0+$/, "");
}
