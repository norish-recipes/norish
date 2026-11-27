"use client";

import { use, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  FullRecipeDTO,
  MeasurementSystem,
  RecipeConversion,
  RecipeIngredientsDto,
} from "@norish/shared/contracts";

import type { RecipeEnrichmentResult } from "./use-recipe-enrichment";
import { useTRPC } from "../trpc";
import {
  LoadedRecipeContext,
  useRecipePageStore,
  useRecipePageStoreApi,
} from "./recipe-page-store";
import { scaleIngredients } from "./scale-ingredients";
import { servingsShown } from "./servings";
import { useConvertMutation } from "./use-convert-mutation";
import { useRecipeEnrichment } from "./use-recipe-enrichment";

/** The page's recipe from the Query cache; renders on its data only. */
export function usePageRecipe(): FullRecipeDTO | null {
  const trpc = useTRPC();
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { data } = useQuery(trpc.recipes.get.queryOptions({ id: recipeId }));

  return data ?? null;
}

/** The page's recipe, for the pieces drawn inside `LoadedPageRecipe`. */
export function useLoadedPageRecipe(): FullRecipeDTO {
  const held = use(LoadedRecipeContext);
  const recipe = usePageRecipe() ?? held;

  if (!recipe) throw new Error("Recipe not loaded");

  return recipe;
}

/** The servings the page shows: the reader's pick, else the recipe's own. */
export function usePageServings(): number {
  const picked = useRecipePageStore((state) => state.servings);
  const recipe = usePageRecipe();

  return servingsShown(picked, recipe?.servings);
}

/** The ingredients at the servings the page shows. */
export function usePageIngredients(): RecipeIngredientsDto[] {
  const recipe = usePageRecipe();
  const servings = usePageServings();

  if (!recipe) return [];

  return scaleIngredients(recipe.recipeIngredients, recipe.servings, servings);
}

/** The page's enrichment states, for showing them; requests go through `useRecipeEnrichment`. */
export function usePageEnrichment(): RecipeEnrichmentResult {
  const recipeId = useRecipePageStore((state) => state.recipeId);

  return useRecipeEnrichment(recipeId);
}

type RecipeConversionResult = {
  /** The system on its way, until the recipe shows it. */
  convertingTo: MeasurementSystem | null;
  /** Converts to `target`; with AI, the copy in it is written again even where one exists. One
   * picked by hand (`manual`) is settled by its own result alone. */
  startConversion: (
    asked: Omit<RecipeConversion, "version">,
    options?: { manual?: boolean }
  ) => void;
};

export function useRecipeConversion(): RecipeConversionResult {
  const store = useRecipePageStoreApi();
  const callbacks = { onError: () => store.getState().conversionFailed() };
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const { convertMeasurements } = useConvertMutation(recipeId, callbacks);
  const conversion = useRecipePageStore((state) => state.conversion);
  const endConversion = useRecipePageStore((state) => state.endConversion);
  const recipe = usePageRecipe();

  // Over once the recipe shows the target (with AI, a copy written again) or moved past the version
  // it was asked on, which the server refuses as stale.
  const isOver =
    !!recipe &&
    !!conversion &&
    (recipe.version > conversion.version ||
      (recipe.systemUsed === conversion.target && !conversion.withAI));

  // Cleared once over, so a later change of the recipe's system doesn't revive it.
  useEffect(() => {
    if (isOver && conversion) endConversion(conversion);
  }, [isOver, conversion, endConversion]);

  return {
    convertingTo: conversion && !isOver ? conversion.target : null,
    startConversion: (asked, { manual = false } = {}) => {
      if (!recipe) return;
      const conversion = { ...asked, version: recipe.version };

      store.getState().startConversion(conversion, manual);
      convertMeasurements(conversion);
    },
  };
}
