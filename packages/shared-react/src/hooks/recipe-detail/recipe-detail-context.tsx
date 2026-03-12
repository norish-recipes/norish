import type { ReactNode } from "react";
import type {
  FullRecipeDTO,
  MeasurementSystem,
  RecipeIngredientsDto,
} from "@norish/shared/contracts";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";


// --- Types ---

export type RecipeDetailContextValue = {
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
  // Allergies list
  allergies: string[];
  allergySet: Set<string>;
  // Rating
  userRating: number | null;
  rateRecipe: (rating: number) => void;
  // Favorite
  liked: boolean;
  toggleLiked: () => void;
};

export type RecipeDetailAdapters = {
  useRecipeQuery: (recipeId: string) => {
    recipe: FullRecipeDTO | null;
    isLoading: boolean;
    error: unknown;
    invalidate: () => void;
  };
  useRecipeSubscription: (recipeId: string) => void;
  useNutritionQuery: (recipeId: string) => {
    isEstimating: boolean;
    setIsEstimating: (v: boolean) => void;
  };
  useNutritionMutation: (recipeId: string) => {
    estimateNutrition: () => void;
  };
  useNutritionSubscription: (recipeId: string, onStart: () => void, onEnd: () => void) => void;
  useAutoTaggingMutation: () => { mutate: (input: { recipeId: string }) => void };
  useAutoTagging: (recipeId: string, onStart: () => void, onEnd: () => void) => void;
  useAutoCategorizationMutation: () => { mutate: (input: { recipeId: string }) => void };
  useAutoCategorization: (recipeId: string, onStart: () => void, onEnd: () => void) => void;
  useAllergyDetectionMutation: () => { mutate: (input: { recipeId: string }) => void };
  useAllergyDetection: (recipeId: string, onStart: () => void, onEnd: () => void) => void;
  useActiveAllergies: () => { allergies: string[]; allergySet: Set<string> };
  useConvertMutation: () => {
    mutate: (
      input: { recipeId: string; targetSystem: MeasurementSystem },
      opts: { onSuccess: () => void; onError: () => void }
    ) => void;
  };
  useRatingQuery: (recipeId: string) => { userRating: number | null };
  useRatingsMutation: () => { rateRecipe: (recipeId: string, rating: number) => void };
  useFavoriteIds: () => string[] | undefined;
  useFavoritesMutation: () => { toggleFavorite: (recipeId: string) => void };
  isNotFoundError: (error: unknown) => boolean;
};

// --- Factory ---

export function createRecipeDetailContext(adapters: RecipeDetailAdapters) {
  const RecipeContext = createContext<RecipeDetailContextValue | null>(null);

  type ProviderProps = {
    recipeId: string;
    children: ReactNode | ((ctx: RecipeDetailContextValue) => ReactNode);
  };

  function RecipeDetailProvider({ recipeId, children }: ProviderProps) {
    const { recipe, isLoading, error } = adapters.useRecipeQuery(recipeId);
    const [_servings, setServings] = useState<number | null>(null);
    const [convertingTo, setConvertingTo] = useState<MeasurementSystem | null>(null);
    const [adjustedIngredients, setAdjustedIngredients] = useState<RecipeIngredientsDto[]>([]);

    const lastRecipeIdRef = React.useRef<string | null>(null);
    const recipeRef = React.useRef(recipe);

    recipeRef.current = recipe;

    // Subscribe to real-time updates
    adapters.useRecipeSubscription(recipeId);

    // Nutrition hooks
    const { isEstimating: isEstimatingNutrition, setIsEstimating: setIsEstimatingNutrition } =
      adapters.useNutritionQuery(recipeId);
    const { estimateNutrition } = adapters.useNutritionMutation(recipeId);

    adapters.useNutritionSubscription(
      recipeId,
      () => setIsEstimatingNutrition(true),
      () => setIsEstimatingNutrition(false)
    );

    // Auto-tagging hooks
    const [isAutoTagging, setIsAutoTagging] = useState(false);
    const autoTagMutation = adapters.useAutoTaggingMutation();

    adapters.useAutoTagging(
      recipeId,
      () => setIsAutoTagging(true),
      () => setIsAutoTagging(false)
    );

    const triggerAutoTag = useCallback(() => {
      if (!recipe) return;
      autoTagMutation.mutate({ recipeId: recipe.id });
    }, [recipe, autoTagMutation]);

    const [isCategorizing, setIsCategorizing] = useState(false);
    const autoCategorizeMutation = adapters.useAutoCategorizationMutation();

    adapters.useAutoCategorization(
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
    const allergyDetectionMutation = adapters.useAllergyDetectionMutation();

    adapters.useAllergyDetection(
      recipeId,
      () => setIsDetectingAllergies(true),
      () => setIsDetectingAllergies(false)
    );

    const triggerAllergyDetection = useCallback(() => {
      if (!recipe) return;
      allergyDetectionMutation.mutate({ recipeId: recipe.id });
    }, [recipe, allergyDetectionMutation]);

    // Get allergies
    const { allergies, allergySet } = adapters.useActiveAllergies();

    // Mutation for converting measurements
    const convertMutation = adapters.useConvertMutation();

    // --- Ratings ---
    const { userRating } = adapters.useRatingQuery(recipeId);
    const { rateRecipe: rateRecipeRaw } = adapters.useRatingsMutation();
    const rateRecipe = useCallback(
      (rating: number) => rateRecipeRaw(recipeId, rating),
      [recipeId, rateRecipeRaw]
    );

    // --- Favorites ---
    const favoriteIds = adapters.useFavoriteIds();
    const { toggleFavorite: toggleFavoriteRaw } = adapters.useFavoritesMutation();
    const liked = useMemo(() => favoriteIds?.includes(recipeId) ?? false, [favoriteIds, recipeId]);
    const toggleLiked = useCallback(
      () => toggleFavoriteRaw(recipeId),
      [recipeId, toggleFavoriteRaw]
    );

    // Check if error is a 404
    const isNotFound = adapters.isNotFoundError(error);

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
        setAdjustedIngredients(recipe.recipeIngredients);
      }
    }, [recipe?.recipeIngredients, recipe?.servings, _servings]);

    // Clear converting state when recipe system matches target
    useEffect(() => {
      if (!recipe || !convertingTo) return;

      if (recipe.systemUsed === convertingTo) {
        setConvertingTo(null);
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

    const setIngredientAmounts = useCallback((servings: number) => {
      const currentRecipe = recipeRef.current;

      if (!currentRecipe || servings == null) return;

      setServings(servings);

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
    }, []);

    const value = useMemo<RecipeDetailContextValue>(
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
        userRating,
        rateRecipe,
        liked,
        toggleLiked,
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
        userRating,
        rateRecipe,
        liked,
        toggleLiked,
      ]
    );

    return (
      <RecipeContext.Provider value={value}>
        {typeof children === "function" ? children(value) : children}
      </RecipeContext.Provider>
    );
  }

  function useRecipeContext() {
    const ctx = useContext(RecipeContext);

    if (!ctx) throw new Error("useRecipeContext must be used within RecipeDetailProvider");

    return ctx;
  }

  function useRecipeContextRequired() {
    const ctx = useRecipeContext();

    if (!ctx.recipe) throw new Error("Recipe not loaded");

    return ctx as typeof ctx & { recipe: NonNullable<typeof ctx.recipe> };
  }

  return {
    RecipeDetailProvider,
    useRecipeContext,
    useRecipeContextRequired,
  };
}
