"use client";

import { useMutation } from "@tanstack/react-query";

import { uploadForm } from "@norish/shared/lib/upload-form";

import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { useTRPC } from "../trpc";
import { OPTIMISTIC_PENDING_RECIPE_PREFIX, useRecipesCacheHelpers } from "./use-recipes-cache";

type ImportMutationContext = {
  optimisticPendingId: string;
};

export type ImportMutationsResult = {
  importRecipe: (url: string) => void;
  importRecipeWithAI: (url: string) => void;
  importRecipeFromImages: (files: File[]) => void;
  importRecipeFromPaste: (text: string) => void;
  importRecipeFromPasteWithAI: (text: string) => void;
};

export type ImportMutationErrorHandler = (error: unknown, operation: string) => void;
/**
 * Told when an import found a recipe the household already holds. Not an
 * error — the id is the one the caller was reaching for, so an app can offer
 * to open it.
 */
export type RecipeAlreadyExistsAdapter = (recipeId: string) => void;

function createOptimisticPendingRecipeId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- a placeholder id needs to be unique, not unpredictable
  return `${OPTIMISTIC_PENDING_RECIPE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useImportMutations(
  onError?: ImportMutationErrorHandler,
  onRecipeAlreadyExists?: RecipeAlreadyExistsAdapter
): ImportMutationsResult {
  const trpc = useTRPC();
  const { addPendingRecipe, replacePendingRecipe, removePendingRecipe, invalidate } =
    useRecipesCacheHelpers();

  const { mutate: mutateImport } = useMutation(
    trpc.recipes.importFromUrl.mutationOptions({
      onMutate: () => {
        const optimisticPendingId = createOptimisticPendingRecipeId();

        addPendingRecipe(optimisticPendingId);

        return { optimisticPendingId };
      },
      onSuccess: ({ recipeId, status }, _variables, context) => {
        // Nothing was queued, so there is no pending recipe to stand in for:
        // drop the placeholder and hand the id to whoever can offer it.
        if (status === "exists") {
          if (context) removePendingRecipe(context.optimisticPendingId);
          onRecipeAlreadyExists?.(recipeId);

          return;
        }

        if (!context) {
          addPendingRecipe(recipeId);

          return;
        }

        replacePendingRecipe(context.optimisticPendingId, recipeId);
      },
      onError: (error, variables, context) => {
        handleImportError(
          error,
          variables.forceAI ? "importFromUrlWithAI" : "importFromUrl",
          context
        );
      },
    })
  );
  const { mutate: mutateImageImport } = useMutation(
    trpc.recipes.importFromImages.mutationOptions({
      onMutate: () => {
        const optimisticPendingId = createOptimisticPendingRecipeId();

        addPendingRecipe(optimisticPendingId);

        return { optimisticPendingId };
      },
      onSuccess: (recipeId, _variables, context) => {
        if (!context) {
          addPendingRecipe(recipeId);

          return;
        }

        replacePendingRecipe(context.optimisticPendingId, recipeId);
      },
      onError: (error, _variables, context) => {
        handleImportError(error, "importFromImages", context);
      },
    })
  );
  const { mutate: mutatePasteImport } = useMutation(
    trpc.recipes.importFromPaste.mutationOptions({
      onMutate: () => {
        const optimisticPendingId = createOptimisticPendingRecipeId();

        addPendingRecipe(optimisticPendingId);

        return { optimisticPendingId };
      },
      onSuccess: (result, _variables, context) => {
        const [firstRecipeId, ...remainingRecipeIds] = result.recipeIds;

        if (!firstRecipeId) {
          if (context) {
            removePendingRecipe(context.optimisticPendingId);
          }

          invalidate();

          return;
        }

        if (!context) {
          result.recipeIds.forEach((recipeId) => addPendingRecipe(recipeId));

          return;
        }

        replacePendingRecipe(context.optimisticPendingId, firstRecipeId);
        remainingRecipeIds.forEach((recipeId) => addPendingRecipe(recipeId));
      },
      onError: (error, variables, context) => {
        handleImportError(
          error,
          variables.forceAI ? "importFromPasteWithAI" : "importFromPaste",
          context
        );
      },
    })
  );

  const handleImportError = (
    error: unknown,
    operation: string,
    context: ImportMutationContext | undefined
  ): void => {
    onError?.(error, operation);

    if (shouldPreserveOptimisticUpdate(error)) {
      return;
    }

    if (context) {
      removePendingRecipe(context.optimisticPendingId);
    }

    invalidate();
  };

  return {
    importRecipe: (url) => mutateImport({ url }),
    importRecipeWithAI: (url) => mutateImport({ url, forceAI: true }),
    importRecipeFromImages: (files) =>
      mutateImageImport(uploadForm(Object.fromEntries(files.map((file, i) => [`file${i}`, file])))),
    importRecipeFromPaste: (text) => mutatePasteImport({ text }),
    importRecipeFromPasteWithAI: (text) => mutatePasteImport({ text, forceAI: true }),
  };
}
