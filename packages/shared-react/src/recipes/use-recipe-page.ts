"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  FullRecipeDTO,
  MeasurementSystem,
  RecipeIngredientsDto,
} from "@norish/shared/contracts";

import { useTRPC } from "../trpc";
import { useRecipePageStore, useRecipePageStoreApi } from "./recipe-page-store";
import { useConvertMutation } from "./use-convert-mutation";

/** The page's recipe from the Query cache; renders on its data only. */
export function usePageRecipe(): FullRecipeDTO | null {
  const trpc = useTRPC();
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { data } = useQuery(trpc.recipes.get.queryOptions({ id: recipeId }));

  return data ?? null;
}

/** The page's recipe, for the pieces drawn once it has loaded. */
export function useLoadedPageRecipe(): FullRecipeDTO {
  const recipe = usePageRecipe();

  if (!recipe) throw new Error("Recipe not loaded");

  return recipe;
}

/** The servings the page shows: the reader's pick, else the recipe's own. */
export function usePageServings(): number {
  const picked = useRecipePageStore((state) => state.servings);
  const recipe = usePageRecipe();

  return picked ?? recipe?.servings ?? 1;
}

/**
 * The ingredients at the servings the page shows: each amount scaled from the
 * recipe's own servings, and the recipe's lines as they are when nothing was picked.
 */
export function usePageIngredients(): RecipeIngredientsDto[] {
  const picked = useRecipePageStore((state) => state.servings);
  const recipe = usePageRecipe();
  const ingredients = recipe?.recipeIngredients;
  const recipeServings = recipe?.servings;

  if (!ingredients) return [];
  if (picked === null || !recipeServings || picked === recipeServings) return ingredients;

  return ingredients.map((ing) => {
    if (ing.amount == null) return ing;

    const amount = Number(ing.amount);

    if (isNaN(amount) || amount <= 0) return ing;

    return { ...ing, amount: Math.round((amount / recipeServings) * picked * 10000) / 10000 };
  });
}

export type RecipeConversionResult = {
  /** The system on its way, until the recipe shows it. */
  convertingTo: MeasurementSystem | null;
  /** Convert to `target`; with AI, the copy in it is written again even where one exists. */
  startConversion: (target: MeasurementSystem, withAI?: boolean) => void;
};

export function useRecipeConversion(): RecipeConversionResult {
  const store = useRecipePageStoreApi();
  const callbacks = { onError: () => store.getState().conversionFailed() };
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { convertMeasurements } = useConvertMutation(recipeId, callbacks);
  const conversion = useRecipePageStore((state) => state.conversion);
  const endConversion = useRecipePageStore((state) => state.endConversion);
  const recipe = usePageRecipe();

  // Over once the recipe shows the target; with AI the copy showing is written
  // again, so it waits for the recipe to change.
  const isOver =
    !!recipe &&
    !!conversion &&
    recipe.systemUsed === conversion.target &&
    (!conversion.withAI || recipe.version !== conversion.version);

  useEffect(() => {
    if (isOver && conversion) endConversion(conversion);
  }, [isOver, conversion, endConversion]);

  return {
    convertingTo: conversion && !isOver ? conversion.target : null,
    startConversion: (target, withAI = false) => {
      if (!recipe) return;

      store.getState().startConversion({ target, withAI, version: recipe.version });
      convertMeasurements(target, recipe.version, withAI);
    },
  };
}
