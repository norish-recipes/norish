"use client";

import type { FullRecipeDTO, MeasurementSystem, RecipeIngredientsDto } from "@/types";

import React, {
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

import {
  useRecipeQuery,
  useRecipeSubscription,
  useNutritionQuery,
  useNutritionMutation,
  useNutritionSubscription,
  useAutoTagging,
  useAutoTaggingMutation,
  useAllergyDetection,
  useAllergyDetectionMutation,
  useAutoCategorization,
  useAutoCategorizationMutation,
} from "@/hooks/recipes";
import { useActiveAllergies } from "@/hooks/user";
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
  // Auto-tagging
  isAutoTagging: boolean;
  triggerAutoTag: () => void;
  isCategorizing: boolean;
  triggerAutoCategorize: () => void;
  // Allergy detection
  isDetectingAllergies: boolean;
  triggerAllergyDetection: () => void;
  // Allergies list (from household or user settings)
  allergies: string[];
  // Pre-computed Set for O(1) lookups
  allergySet: Set<string>;
};

const RecipeContext = createContext<Ctx | null>(null);

type ProviderProps = { recipeId: string; children: ReactNode | ((ctx: Ctx) => ReactNode) };

export function RecipeContextProvider({ recipeId, children }: ProviderProps) {
  const trpc = useTRPC();
  const { recipe, isLoading, error, invalidate: _invalidate } = useRecipeQuery(recipeId);
  const [_servings, setServings] = useState<number | null>(null);
  const [convertingTo, setConvertingTo] = useState<MeasurementSystem | null>(null);
  const [adjustedIngredients, setAdjustedIngredients] = useState<RecipeIngredientsDto[]>([]);

  // Track the last recipe ID to detect recipe navigation
  const lastRecipeIdRef = React.useRef<string | null>(null);

  // Ref for recipe to keep callbacks stable
  const recipeRef = React.useRef(recipe);

  recipeRef.current = recipe;

  // Subscribe to real-time updates for this recipe
  useRecipeSubscription(recipeId);

  // Nutrition hooks
  const { isEstimating: isEstimatingNutrition, setIsEstimating: setIsEstimatingNutrition } =
    useNutritionQuery(recipeId);
  const { estimateNutrition } = useNutritionMutation(recipeId);

  useNutritionSubscription(
    recipeId,
    () => setIsEstimatingNutrition(true),
    () => setIsEstimatingNutrition(false)
  );

  // Auto-tagging hooks
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const autoTagMutation = useAutoTaggingMutation();

  useAutoTagging(
    recipeId,
    () => setIsAutoTagging(true),
    () => setIsAutoTagging(false)
  );

  const triggerAutoTag = useCallback(() => {
    if (!recipe) return;
    autoTagMutation.mutate({ recipeId: recipe.id });
  }, [recipe, autoTagMutation]);

  const [isCategorizing, setIsCategorizing] = useState(false);
  const autoCategorizeMutation = useAutoCategorizationMutation();

  useAutoCategorization(
    recipeId,
    () => setIsCategorizing(true),
    () => setIsCategorizing(false)
  );

  const triggerAutoCategorize = useCallback(() => {
    if (!recipe) return;
    autoCategorizeMutation.mutate({ recipeId: recipe.id });
  }, [recipe, autoCategorizeMutation]);

  // Allergy detection hooks
  const [isDetectingAllergies, setIsDetectingAllergies] = useState(false);
  const allergyDetectionMutation = useAllergyDetectionMutation();

  useAllergyDetection(
    recipeId,
    () => setIsDetectingAllergies(true),
    () => setIsDetectingAllergies(false)
  );

  const triggerAllergyDetection = useCallback(() => {
    if (!recipe) return;
    allergyDetectionMutation.mutate({ recipeId: recipe.id });
  }, [recipe, allergyDetectionMutation]);

  // Get allergies from household (if in one) or user settings (if solo)
  const { allergies, allergySet } = useActiveAllergies();

  // Mutation for converting measurements
  const convertMutation = useMutation(trpc.recipes.convertMeasurements.mutationOptions());

  // Check if error is a 404 (NOT_FOUND)
  const isNotFound = error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";

  // Reset servings when navigating to a different recipe
  useEffect(() => {
    if (!recipe) return;

    if (lastRecipeIdRef.current !== recipe.id) {
      lastRecipeIdRef.current = recipe.id;
      setServings(null);
    }
  }, [recipe]);

  // Sync adjustedIngredients with recipe.recipeIngredients
  useEffect(() => {
    if (!recipe?.recipeIngredients) return;

    // If user has custom servings, scale the new ingredients
    if (_servings !== null && _servings !== recipe.servings) {
      setAdjustedIngredients(
        recipe.recipeIngredients.map((ing) => {
          if (ing.amount == null) return ing;

          const amountNum = Number(ing.amount);

          if (isNaN(amountNum) || amountNum <= 0) return ing;

          const newAmount = Math.round((amountNum / recipe.servings) * _servings * 10000) / 10000;

          return { ...ing, amount: newAmount };
        })
      );
    } else {
      // No custom servings, use ingredients as-is
      setAdjustedIngredients(recipe.recipeIngredients);
    }
  }, [recipe?.recipeIngredients, recipe?.servings, _servings]);

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
      const currentRecipe = recipeRef.current;

      if (!currentRecipe || servings == null) return;

      setServings(servings);

      // If servings equals original recipe servings, reset to original amounts
      if (servings === currentRecipe.servings) {
        setAdjustedIngredients(currentRecipe.recipeIngredients);

        return;
      }

      setAdjustedIngredients(
        currentRecipe.recipeIngredients.map((ing) => {
          if (ing.amount == null && ing.amount === "") return ing;

          const amountNum = Number(ing.amount);

          if (isNaN(amountNum) || amountNum <= 0) return ing;

          const newAmount =
            Math.round((amountNum / currentRecipe.servings) * servings * 10000) / 10000;

          return { ...ing, amount: newAmount };
        })
      );
    },
    [] // No dependencies - uses ref for recipe
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
      isAutoTagging,
      triggerAutoTag,
      isCategorizing,
      triggerAutoCategorize,
      isDetectingAllergies,
      triggerAllergyDetection,
      allergies,
      allergySet,
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
      isAutoTagging,
      triggerAutoTag,
      isCategorizing,
      triggerAutoCategorize,
      isDetectingAllergies,
      triggerAllergyDetection,
      allergies,
      allergySet,
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
