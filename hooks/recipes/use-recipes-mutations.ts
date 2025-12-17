"use client";

import type { FullRecipeInsertDTO, FullRecipeUpdateDTO, MeasurementSystem } from "@/types";

import { useMutation } from "@tanstack/react-query";

import { useRecipesQuery } from "./use-recipes-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type RecipesMutationsResult = {
  /** Import a recipe from URL. Fire-and-forget. */
  importRecipe: (url: string) => void;
  /** Import a recipe from URL using AI only. Fire-and-forget. */
  importRecipeWithAI: (url: string) => void;
  /** Import a recipe from images using AI vision. Fire-and-forget. */
  importRecipeFromImages: (files: File[]) => void;
  /** Create a recipe manually. Fire-and-forget. */
  createRecipe: (input: FullRecipeInsertDTO) => void;
  /** Update a recipe. Fire-and-forget. */
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  /** Delete a recipe. Fire-and-forget. */
  deleteRecipe: (id: string) => void;
  /** Convert recipe measurements. Fire-and-forget. */
  convertMeasurements: (recipeId: string, system: MeasurementSystem) => void;
};

export function useRecipesMutations(): RecipesMutationsResult {
  const trpc = useTRPC();
  const { addPendingRecipe, invalidate } = useRecipesQuery();

  const importMutation = useMutation(trpc.recipes.importFromUrl.mutationOptions());
  const imageImportMutation = useMutation(trpc.recipes.importFromImages.mutationOptions());
  const createMutation = useMutation(trpc.recipes.create.mutationOptions());
  const updateMutation = useMutation(trpc.recipes.update.mutationOptions());
  const deleteMutation = useMutation(trpc.recipes.delete.mutationOptions());
  const convertMutation = useMutation(trpc.recipes.convertMeasurements.mutationOptions());

  const importRecipe = (url: string): void => {
    importMutation.mutate(
      { url },
      {
        onSuccess: (recipeId) => {
          addPendingRecipe(recipeId);
        },
        onError: () => invalidate(),
      }
    );
  };

  const importRecipeWithAI = (url: string): void => {
    importMutation.mutate(
      { url, forceAI: true },
      {
        onSuccess: (recipeId) => {
          addPendingRecipe(recipeId);
        },
        onError: () => invalidate(),
      }
    );
  };

  const createRecipe = (input: FullRecipeInsertDTO): void => {
    createMutation.mutate(input, {
      onSuccess: (recipeId) => {
        addPendingRecipe(recipeId);
      },
      onError: () => invalidate(),
    });
  };

  const updateRecipe = (id: string, input: FullRecipeUpdateDTO): void => {
    updateMutation.mutate(
      { id, data: input },
      {
        onError: () => invalidate(),
      }
    );
  };

  const deleteRecipe = (id: string): void => {
    deleteMutation.mutate(
      { id },
      {
        onError: () => invalidate(),
      }
    );
  };

  const convertMeasurements = (recipeId: string, targetSystem: MeasurementSystem): void => {
    convertMutation.mutate(
      { recipeId, targetSystem },
      {
        onError: () => invalidate(),
      }
    );
  };

  const importRecipeFromImages = (files: File[]): void => {
    // Build FormData with files
    const formData = new FormData();
    files.forEach((file, i) => {
      formData.append(`file${i}`, file);
    });

    imageImportMutation.mutate(formData, {
      onSuccess: (recipeId) => {
        addPendingRecipe(recipeId);
      },
      onError: () => invalidate(),
    });
  };

  return {
    importRecipe,
    importRecipeWithAI,
    importRecipeFromImages,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    convertMeasurements,
  };
}

