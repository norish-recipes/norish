import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  FullRecipeDTO,
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  MeasurementSystem,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";

import type { CreateRecipeHooksOptions } from "../types";
import type { RecipesCacheHelpers } from "./use-recipes-cache";
import { shouldPreserveOptimisticUpdate as preserveOptimisticUpdate } from "../../optimistic-updates";
import { OPTIMISTIC_PENDING_RECIPE_PREFIX } from "./use-recipes-cache";

type RecipeListPage = {
  recipes: RecipeDashboardDTO[];
  total: number;
  nextCursor: number | null;
};

type InfiniteRecipeData = InfiniteData<RecipeListPage>;

type ImportMutationContext = {
  optimisticPendingId: string;
};

type DeleteMutationContext = {
  detailQueryKey: QueryKey;
  previousDetail: FullRecipeDTO | null | undefined;
  previousRecipeLists: [QueryKey, InfiniteRecipeData | undefined][];
};

function createOptimisticPendingRecipeId(): string {
  return `${OPTIMISTIC_PENDING_RECIPE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function removeRecipeFromLists(
  previousData: InfiniteRecipeData | undefined,
  recipeId: string
): InfiniteRecipeData | undefined {
  if (!previousData?.pages) {
    return previousData;
  }

  const recipeExists = previousData.pages.some((page) =>
    page.recipes.some((recipe) => recipe.id === recipeId)
  );

  if (!recipeExists) {
    return previousData;
  }

  return {
    ...previousData,
    pages: previousData.pages.map((page) => ({
      ...page,
      recipes: page.recipes.filter((recipe) => recipe.id !== recipeId),
      total: Math.max(page.total - 1, 0),
    })),
  };
}

function restoreRecipeLists(
  queryClient: QueryClient,
  previousRecipeLists: [QueryKey, InfiniteRecipeData | undefined][]
): void {
  for (const [queryKey, data] of previousRecipeLists) {
    queryClient.setQueryData<InfiniteRecipeData | undefined>(queryKey, data);
  }
}

export type RecipesMutationsResult = {
  importRecipe: (url: string) => void;
  importRecipeWithAI: (url: string) => void;
  importRecipeFromImages: (files: File[]) => void;
  importRecipeFromPaste: (text: string) => void;
  importRecipeFromPasteWithAI: (text: string) => void;
  createRecipe: (input: FullRecipeInsertDTO) => void;
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  deleteRecipe: (id: string, version: number) => void;
  convertMeasurements: (recipeId: string, system: MeasurementSystem, version: number) => void;
};

export type RecipesMutationErrorHandler = (error: unknown, operation: string) => void;

export function createUseRecipesMutations(
  { useTRPC, shouldPreserveOptimisticUpdate }: CreateRecipeHooksOptions,
  dependencies: {
    useRecipesCacheHelpers: () => Pick<
      RecipesCacheHelpers,
      | "addPendingRecipe"
      | "replacePendingRecipe"
      | "removePendingRecipe"
      | "setAllRecipesData"
      | "invalidate"
    >;
  }
) {
  return function useRecipesMutations(
    onError?: RecipesMutationErrorHandler
  ): RecipesMutationsResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const {
      addPendingRecipe,
      replacePendingRecipe,
      removePendingRecipe,
      setAllRecipesData,
      invalidate,
    } = dependencies.useRecipesCacheHelpers();

    const shouldPreserve = (error: unknown): boolean => {
      return preserveOptimisticUpdate(error, shouldPreserveOptimisticUpdate);
    };

    const recipesPath = [trpc.recipes.list.queryKey({})[0]];

    const importMutation = useMutation(
      trpc.recipes.importFromUrl.mutationOptions({
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
        onError: (error, variables, context) => {
          handleImportError(
            error,
            variables.forceAI ? "importFromUrlWithAI" : "importFromUrl",
            context
          );
        },
      })
    );
    const imageImportMutation = useMutation(
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
    const pasteImportMutation = useMutation(
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
    const createMutation = useMutation(trpc.recipes.create.mutationOptions());
    const updateMutation = useMutation(trpc.recipes.update.mutationOptions());
    const deleteMutation = useMutation(
      trpc.recipes.delete.mutationOptions({
        onMutate: async ({ id }) => {
          const detailQueryKey = trpc.recipes.get.queryKey({ id });

          await Promise.all([
            queryClient.cancelQueries({ queryKey: recipesPath }),
            queryClient.cancelQueries({ queryKey: detailQueryKey }),
          ]);

          const previousRecipeLists = queryClient.getQueriesData<InfiniteRecipeData>({
            queryKey: recipesPath,
          });
          const previousDetail = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);

          setAllRecipesData((previousData) => removeRecipeFromLists(previousData, id));
          queryClient.setQueryData<FullRecipeDTO | null>(detailQueryKey, null);

          return {
            detailQueryKey,
            previousDetail,
            previousRecipeLists,
          };
        },
        onError: (error, _variables, context) => {
          onError?.(error, "delete");

          if (shouldPreserve(error)) {
            return;
          }

          restoreDeletedRecipe(context);
          invalidate();

          if (context?.detailQueryKey) {
            queryClient.invalidateQueries({ queryKey: context.detailQueryKey });
          }
        },
      })
    );
    const convertMutation = useMutation(trpc.recipes.convertMeasurements.mutationOptions());

    const restoreDeletedRecipe = (context: DeleteMutationContext | undefined): void => {
      if (!context) {
        return;
      }

      restoreRecipeLists(queryClient, context.previousRecipeLists);
      queryClient.setQueryData<FullRecipeDTO | null | undefined>(
        context.detailQueryKey,
        context.previousDetail
      );
    };

    const handleImportError = (
      error: unknown,
      operation: string,
      context: ImportMutationContext | undefined
    ): void => {
      onError?.(error, operation);

      if (shouldPreserve(error)) {
        return;
      }

      if (context) {
        removePendingRecipe(context.optimisticPendingId);
      }

      invalidate();
    };

    const importRecipe = (url: string): void => {
      importMutation.mutate({ url });
    };

    const importRecipeWithAI = (url: string): void => {
      importMutation.mutate({ url, forceAI: true });
    };

    const createRecipe = (input: FullRecipeInsertDTO): void => {
      createMutation.mutate(input, {
        onError: (error) => {
          onError?.(error, "create");

          if (!shouldPreserve(error)) {
            invalidate();
          }
        },
      });
    };

    const updateRecipe = (id: string, input: FullRecipeUpdateDTO): void => {
      updateMutation.mutate(
        { id, version: input.version ?? 1, data: input },
        {
          onError: (error) => {
            onError?.(error, "update");

            if (!shouldPreserve(error)) {
              invalidate();
            }
          },
        }
      );
    };

    const deleteRecipe = (id: string, version: number): void => {
      deleteMutation.mutate({ id, version });
    };

    const convertMeasurements = (
      recipeId: string,
      targetSystem: MeasurementSystem,
      version: number
    ): void => {
      convertMutation.mutate(
        { recipeId, targetSystem, version },
        {
          onError: (error) => {
            onError?.(error, "convertMeasurements");

            if (!shouldPreserve(error)) {
              invalidate();
            }
          },
        }
      );
    };

    const importRecipeFromImages = (files: File[]): void => {
      const formData = new FormData();

      files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const imageInput = formData as Parameters<typeof imageImportMutation.mutate>[0];

      imageImportMutation.mutate(imageInput);
    };

    const importRecipeFromPaste = (text: string): void => {
      pasteImportMutation.mutate({ text });
    };

    const importRecipeFromPasteWithAI = (text: string): void => {
      pasteImportMutation.mutate({ text, forceAI: true });
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
