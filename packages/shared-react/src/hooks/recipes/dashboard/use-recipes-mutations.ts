
import type {
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  MeasurementSystem,
} from "@norish/shared/contracts";
import type { CreateRecipeHooksOptions } from "../types";
import type { RecipesQueryResult } from "./use-recipes-query";

import { useMutation } from "@tanstack/react-query";

export type RecipesMutationsResult = {
  importRecipe: (url: string) => void;
  importRecipeWithAI: (url: string) => void;
  importRecipeFromImages: (files: File[]) => void;
  importRecipeFromPaste: (text: string) => void;
  importRecipeFromPasteWithAI: (text: string) => void;
  createRecipe: (input: FullRecipeInsertDTO) => void;
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  deleteRecipe: (id: string) => void;
  convertMeasurements: (recipeId: string, system: MeasurementSystem) => void;
};

export type RecipesMutationErrorHandler = (error: unknown, operation: string) => void;

export function createUseRecipesMutations(
  { useTRPC }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipesQuery: () => Pick<RecipesQueryResult, "addPendingRecipe" | "invalidate">;
  }
) {
  return function useRecipesMutations(
    onError?: RecipesMutationErrorHandler
  ): RecipesMutationsResult {
    const trpc = useTRPC();
    const { addPendingRecipe, invalidate } = dependencies.useRecipesQuery();

    const importMutation = useMutation(trpc.recipes.importFromUrl.mutationOptions());
    const imageImportMutation = useMutation(trpc.recipes.importFromImages.mutationOptions());
    const pasteImportMutation = useMutation(trpc.recipes.importFromPaste.mutationOptions());
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
          onError: (e) => {
            onError?.(e, "importFromUrl");
            invalidate();
          },
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
          onError: (e) => {
            onError?.(e, "importFromUrlWithAI");
            invalidate();
          },
        }
      );
    };

    const createRecipe = (input: FullRecipeInsertDTO): void => {
      createMutation.mutate(input, {
        onError: (e) => {
          onError?.(e, "create");
          invalidate();
        },
      });
    };

    const updateRecipe = (id: string, input: FullRecipeUpdateDTO): void => {
      updateMutation.mutate(
        { id, data: input },
        {
          onError: (e) => {
            onError?.(e, "update");
            invalidate();
          },
        }
      );
    };

    const deleteRecipe = (id: string): void => {
      deleteMutation.mutate(
        { id },
        {
          onError: (e) => {
            onError?.(e, "delete");
            invalidate();
          },
        }
      );
    };

    const convertMeasurements = (recipeId: string, targetSystem: MeasurementSystem): void => {
      convertMutation.mutate(
        { recipeId, targetSystem },
        {
          onError: (e) => {
            onError?.(e, "convertMeasurements");
            invalidate();
          },
        }
      );
    };

    const importRecipeFromImages = (files: File[]): void => {
      const formData = new FormData();

      files.forEach((file, i) => {
        formData.append(`file${i}`, file);
      });

      const imageInput = formData as Parameters<typeof imageImportMutation.mutate>[0];

      imageImportMutation.mutate(imageInput, {
        onSuccess: (recipeId) => {
          addPendingRecipe(recipeId);
        },
        onError: (e) => {
          onError?.(e, "importFromImages");
          invalidate();
        },
      });
    };

    const importRecipeFromPaste = (text: string): void => {
      pasteImportMutation.mutate(
        { text },
        {
          onSuccess: (recipeId) => {
            addPendingRecipe(recipeId);
          },
          onError: (e) => {
            onError?.(e, "importFromPaste");
            invalidate();
          },
        }
      );
    };

    const importRecipeFromPasteWithAI = (text: string): void => {
      pasteImportMutation.mutate(
        { text, forceAI: true },
        {
          onSuccess: (recipeId) => {
            addPendingRecipe(recipeId);
          },
          onError: (e) => {
            onError?.(e, "importFromPasteWithAI");
            invalidate();
          },
        }
      );
    };

    return {
      importRecipe,
      importRecipeWithAI,
      importRecipeFromImages,
      importRecipeFromPaste,
      importRecipeFromPasteWithAI,
      createRecipe,
      updateRecipe,
      deleteRecipe,
      convertMeasurements,
    };
  };
}
