"use client";

import { useMutation } from "@tanstack/react-query";

import { uploadForm } from "@norish/shared/lib/upload-form";

import type { RecipesMutationErrorHandler } from "./recipes-mutation-error";
import { useTRPC } from "../trpc";
import { handleRecipesMutationError } from "./recipes-mutation-error";
import { OPTIMISTIC_PENDING_RECIPE_PREFIX, useRecipesCacheHelpers } from "./use-recipes-cache";

type ImportMutationContext = {
  optimisticPendingId: string;
};

/** Told how one import ended: null once the server took it, else the error (a Queued one included). */
export type ImportSettled = (error: unknown) => void;

type ImportMutationsResult = {
  importRecipe: (url: string, onSettled?: ImportSettled) => void;
  importRecipeWithAI: (url: string) => void;
  /** Browser `File`s or expo-file-system `File`s, which are Blobs too. */
  importRecipeFromImages: (files: Blob[], onSettled?: ImportSettled) => void;
  importRecipeFromPaste: (text: string, onSettled?: ImportSettled) => void;
  importRecipeFromPasteWithAI: (text: string) => void;
};

/** Runs a mutation and reports its end; rollback and toasts stay in `useMutation`'s own options. */
function settle(run: Promise<unknown>, onSettled?: ImportSettled): void {
  void run.then(
    () => onSettled?.(null),
    (error: unknown) => onSettled?.(error)
  );
}

/** Told the id of a recipe the household already holds: not an error, so an app can offer it. */
type RecipeAlreadyExistsHandler = (recipeId: string) => void;

function createOptimisticPendingRecipeId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- a placeholder id needs to be unique, not unpredictable
  return `${OPTIMISTIC_PENDING_RECIPE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useImportMutations(
  onError?: RecipesMutationErrorHandler,
  onRecipeAlreadyExists?: RecipeAlreadyExistsHandler
): ImportMutationsResult {
  const trpc = useTRPC();
  const { addPendingRecipe, replacePendingRecipe, removePendingRecipe, invalidate } =
    useRecipesCacheHelpers();

  const addPlaceholder = (): ImportMutationContext => {
    const optimisticPendingId = createOptimisticPendingRecipeId();

    addPendingRecipe(optimisticPendingId);

    return { optimisticPendingId };
  };

  const dropPlaceholder = (context: ImportMutationContext | undefined): void => {
    if (context) removePendingRecipe(context.optimisticPendingId);
  };

  // The placeholder becomes the imported recipe; without one, the recipe is added.
  const showImported = (recipeId: string, context: ImportMutationContext | undefined): void => {
    if (!context) {
      addPendingRecipe(recipeId);

      return;
    }

    replacePendingRecipe(context.optimisticPendingId, recipeId);
  };

  const handleImportError = (
    error: unknown,
    operation: string,
    context: ImportMutationContext | undefined
  ): void => {
    handleRecipesMutationError(error, operation, onError, () => {
      dropPlaceholder(context);
      invalidate();
    });
  };

  const { mutateAsync: mutateImport } = useMutation(
    trpc.recipes.importFromUrl.mutationOptions({
      onMutate: addPlaceholder,
      onSuccess: ({ recipeId, status }, _variables, context) => {
        // Nothing was queued, so there is no pending recipe to stand in for:
        // drop the placeholder and hand the id to whoever can offer it.
        if (status === "exists") {
          dropPlaceholder(context);
          onRecipeAlreadyExists?.(recipeId);

          return;
        }

        showImported(recipeId, context);
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
  const { mutateAsync: mutateImageImport } = useMutation(
    trpc.recipes.importFromImages.mutationOptions({
      onMutate: addPlaceholder,
      onSuccess: (recipeId, _variables, context) => {
        showImported(recipeId, context);
      },
      onError: (error, _variables, context) => {
        handleImportError(error, "importFromImages", context);
      },
    })
  );
  const { mutateAsync: mutatePasteImport } = useMutation(
    trpc.recipes.importFromPaste.mutationOptions({
      onMutate: addPlaceholder,
      onSuccess: (result, _variables, context) => {
        const [firstRecipeId, ...remainingRecipeIds] = result.recipeIds;

        if (!firstRecipeId) {
          dropPlaceholder(context);
          invalidate();

          return;
        }

        showImported(firstRecipeId, context);
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

  return {
    importRecipe: (url, onSettled) => settle(mutateImport({ url }), onSettled),
    importRecipeWithAI: (url) => settle(mutateImport({ url, forceAI: true })),
    importRecipeFromImages: (files, onSettled) =>
      settle(
        mutateImageImport(
          uploadForm(Object.fromEntries(files.map((file, i) => [`file${i}`, file])))
        ),
        onSettled
      ),
    importRecipeFromPaste: (text, onSettled) => settle(mutatePasteImport({ text }), onSettled),
    importRecipeFromPasteWithAI: (text) => settle(mutatePasteImport({ text, forceAI: true })),
  };
}
