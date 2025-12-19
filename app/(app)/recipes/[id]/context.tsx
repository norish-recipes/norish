"use client";

import type { FullRecipeDTO, MeasurementSystem, RecipeIngredientsDto } from "@/types";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

import { useRecipeQuery, useRecipeSubscription, useNutritionQuery, useNutritionMutation, useNutritionSubscription } from "@/hooks/recipes";
import { useTRPC } from "@/app/providers/trpc-provider";

type Ctx = {
  recipe: FullRecipeDTO | null;
  isLoading: boolean;
  error: Error | null;
  isNotFound: boolean;
  convertingTo: MeasurementSystem | null;
  adjustedIngredients: RecipeIngredientsDto[];
  currentServings: number;
  setIngredientAmounts: (servings: number) => void;
  startConversion: (target: MeasurementSystem) => void;
  reset: () => void;
  // Nutrition
  isEstimatingNutrition: boolean;
  estimateNutrition: () => void;
};

const RecipeContext = createContext<Ctx | null>(null);

type ProviderProps = { recipeId: string; children: ReactNode | ((ctx: Ctx) => ReactNode) };

export function RecipeContextProvider({ recipeId, children }: ProviderProps) {
  const trpc = useTRPC();
  const { recipe, isLoading, error, invalidate: _invalidate } = useRecipeQuery(recipeId);
  const [_servings, setServings] = useState<number | null>(null);
  const [convertingTo, setConvertingTo] = useState<MeasurementSystem | null>(null);
  const [adjustedIngredients, setAdjustedIngredients] = useState<RecipeIngredientsDto[]>(
    recipe?.recipeIngredients ?? []
  );
  // Subscribe to real-time updates for this recipe
  useRecipeSubscription(recipeId);

  // Nutrition hooks
  const { isEstimating: isEstimatingNutrition, setIsEstimating: setIsEstimatingNutrition } = useNutritionQuery(recipeId);
  const { estimateNutrition } = useNutritionMutation(recipeId);
  useNutritionSubscription(
    recipeId,
    () => setIsEstimatingNutrition(true),
    () => setIsEstimatingNutrition(false)
  );

  // Mutation for converting measurements
  const convertMutation = useMutation(trpc.recipes.convertMeasurements.mutationOptions());

  // Check if error is a 404 (NOT_FOUND)
  const isNotFound = error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";

  // Clear converting state when recipe system matches target
  useEffect(() => {
    if (!recipe || !convertingTo) return;

    if (recipe.systemUsed === convertingTo) {
      setConvertingTo(null);
      // Update adjusted ingredients with new converted values
      setAdjustedIngredients(recipe.recipeIngredients);
    }
  }, [recipe, convertingTo]);

  const reset = useCallback(() => {
    if (!recipe) return;

    setConvertingTo(null);
    setServings(recipe.servings);
    setAdjustedIngredients(recipe.recipeIngredients);
  }, [recipe]);

  const startConversion = useCallback(
    (target: MeasurementSystem) => {
      convertMutation.mutate(
        { recipeId: recipe!.id, targetSystem: target },
        {
          onSuccess: () => {
            setConvertingTo(target);
          },
          onError: () => {
            reset();
          },
        }
      );
    },
    [convertMutation, recipe, reset]
  );

  const setIngredientAmounts = useCallback(
    (servings: number) => {
      if (!recipe || servings == null) return;

      setServings(servings);

      // If servings equals original recipe servings, reset to original amounts
      if (servings === recipe.servings) {
        setAdjustedIngredients(recipe.recipeIngredients);

        return;
      }

      setAdjustedIngredients(
        recipe.recipeIngredients.map((ing) => {
          if (ing.amount == null && ing.amount === "") return ing;

          const amountNum = Number(ing.amount);

          if (isNaN(amountNum) || amountNum <= 0) return ing;

          const newAmount = Math.round((amountNum / recipe.servings) * servings * 10000) / 10000;

          return { ...ing, amount: newAmount };
        })
      );
    },
    [recipe]
  );

  const value = useMemo<Ctx>(
    () => ({
      recipe,
      isLoading,
      error: error instanceof Error ? error : error ? new Error(String(error)) : null,
      isNotFound,
      convertingTo,
      adjustedIngredients,
      currentServings: _servings ?? recipe?.servings ?? 1,
      setIngredientAmounts,
      startConversion,
      reset,
      isEstimatingNutrition,
      estimateNutrition,
    }),
    [
      recipe,
      isLoading,
      error,
      isNotFound,
      convertingTo,
      adjustedIngredients,
      _servings,
      setIngredientAmounts,
      startConversion,
      reset,
      isEstimatingNutrition,
      estimateNutrition,
    ]
  );

  return (
    <RecipeContext.Provider value={value}>
      {typeof children === "function" ? children(value) : children}
    </RecipeContext.Provider>
  );
}

export function useRecipeContext() {
  const ctx = useContext(RecipeContext);

  if (!ctx) throw new Error("useRecipeContext must be used within RecipeContextProvider");

  return ctx;
}

/**
 * Returns context with recipe guaranteed to be non-null (throws if not loaded)
 */
export function useRecipeContextRequired() {
  const ctx = useRecipeContext();

  if (!ctx.recipe) throw new Error("Recipe not loaded");

  return ctx as typeof ctx & { recipe: NonNullable<typeof ctx.recipe> };
}
