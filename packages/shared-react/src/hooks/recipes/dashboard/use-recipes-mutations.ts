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

type CreateMutationContext = {
  detailQueryKey?: QueryKey;
  previousDetail?: FullRecipeDTO | null | undefined;
  previousRecipeLists?: [QueryKey, InfiniteRecipeData | undefined][];
};

type DeleteMutationContext = {
  detailQueryKey: QueryKey;
  previousDetail: FullRecipeDTO | null | undefined;
  previousRecipeLists: [QueryKey, InfiniteRecipeData | undefined][];
};

type UpdateMutationContext = {
  detailQueryKey: QueryKey;
  previousDetail: FullRecipeDTO | null | undefined;
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

function addRecipeToLists(
  previousData: InfiniteRecipeData | undefined,
  recipe: RecipeDashboardDTO
): InfiniteRecipeData | undefined {
  if (!previousData?.pages?.length) {
    return {
      pages: [{ recipes: [recipe], total: 1, nextCursor: null }],
      pageParams: [0],
    };
  }

  const firstPage = previousData.pages[0];

  if (!firstPage) {
    return previousData;
  }

  if (firstPage.recipes.some((currentRecipe) => currentRecipe.id === recipe.id)) {
    return previousData;
  }

  return {
    ...previousData,
    pages: [
      { ...firstPage, recipes: [recipe, ...firstPage.recipes], total: firstPage.total + 1 },
      ...previousData.pages.slice(1),
    ],
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
}

function createOptimisticId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function createOptimisticFullRecipe(input: FullRecipeInsertDTO): FullRecipeDTO | null {
  if (!input.id) {
    return null;
  }

  const now = new Date();
  const systemUsed = input.systemUsed ?? "metric";

  return {
    id: input.id,
    userId: null,
    name: input.name,
    description: input.description ?? null,
    notes: input.notes ?? null,
    url: input.url ?? null,
    image: input.image ?? null,
    servings: input.servings ?? 1,
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    totalMinutes: input.totalMinutes ?? null,
    calories: input.calories ?? null,
    fat: input.fat ?? null,
    carbs: input.carbs ?? null,
    protein: input.protein ?? null,
    systemUsed,
    createdAt: now,
    updatedAt: now,
    tags: (input.tags ?? []).map((tag) => ({ name: tag.name, version: 1 })),
    categories: input.categories ?? [],
    recipeIngredients: (input.recipeIngredients ?? []).map((ingredient, index) => ({
      id: ingredient.id ?? createOptimisticId(),
      ingredientId: ingredient.ingredientId ?? null,
      ingredientName: ingredient.ingredientName ?? "",
      amount: toNullableNumber(ingredient.amount),
      unit: ingredient.unit ?? null,
      order: toNumber(ingredient.order, index),
      systemUsed: ingredient.systemUsed ?? systemUsed,
      version: ingredient.version ?? 1,
    })),
    steps: (input.steps ?? []).map((step, index) => ({
      step: step.step,
      systemUsed: step.systemUsed ?? systemUsed,
      order: toNumber(step.order, index),
      version: step.version ?? 1,
      images: (step.images ?? []).map((image) => ({
        id: image.id ?? createOptimisticId(),
        image: image.image,
        order: toNumber(image.order),
        version: image.version ?? 1,
      })),
    })),
    author: undefined,
    images: (input.images ?? []).map((image) => ({
      id: image.id ?? createOptimisticId(),
      image: image.image,
      order: toNumber(image.order),
      version: image.version ?? 1,
    })),
    videos: (input.videos ?? []).map((video) => ({
      id: video.id ?? createOptimisticId(),
      video: video.video,
      thumbnail: video.thumbnail ?? null,
      duration: toNullableNumber(video.duration),
      order: toNumber(video.order),
      version: video.version ?? 1,
    })),
    version: 1,
  };
}

function createOptimisticDashboardRecipe(recipe: FullRecipeDTO): RecipeDashboardDTO {
  return {
    id: recipe.id,
    userId: recipe.userId,
    name: recipe.name,
    description: recipe.description,
    notes: recipe.notes,
    url: recipe.url,
    image: recipe.image,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    calories: recipe.calories,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    tags: recipe.tags,
    categories: recipe.categories,
    author: recipe.author,
    averageRating: null,
    ratingCount: 0,
    version: recipe.version,
  };
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
    const createMutation = useMutation(
      trpc.recipes.create.mutationOptions({
        onMutate: async (input) => {
          const optimisticRecipe = createOptimisticFullRecipe(input);

          if (!optimisticRecipe) {
            return {};
          }

          const detailQueryKey = trpc.recipes.get.queryKey({ id: optimisticRecipe.id });

          await Promise.all([
            queryClient.cancelQueries({ queryKey: detailQueryKey }),
            queryClient.cancelQueries({ queryKey: recipesPath }),
          ]);

          const previousDetail = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);
          const previousRecipeLists = queryClient.getQueriesData<InfiniteRecipeData>({
            queryKey: recipesPath,
          });

          queryClient.setQueryData<FullRecipeDTO | null>(detailQueryKey, optimisticRecipe);
          setAllRecipesData((previousData) =>
            addRecipeToLists(previousData, createOptimisticDashboardRecipe(optimisticRecipe))
          );

          return { detailQueryKey, previousDetail, previousRecipeLists };
        },
      })
    );
    const updateMutation = useMutation(
      trpc.recipes.update.mutationOptions({
        onMutate: async ({ id, data }) => {
          const detailQueryKey = trpc.recipes.get.queryKey({ id });

          await queryClient.cancelQueries({ queryKey: detailQueryKey });

          const previousDetail = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);

          queryClient.setQueryData<FullRecipeDTO | null | undefined>(detailQueryKey, (previous) => {
            if (!previous) return previous;

            return {
              ...previous,
              ...data,
              recipeIngredients: data.recipeIngredients ?? previous.recipeIngredients,
              steps: data.steps ?? previous.steps,
              tags: data.tags ?? previous.tags,
              images: data.images ?? previous.images,
              videos: data.videos ?? previous.videos,
            };
          });

          return { detailQueryKey, previousDetail };
        },
      })
    );
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
        onError: (error, _variables, context) => {
          onError?.(error, "create");

          if (!shouldPreserve(error)) {
            const createContext = context as CreateMutationContext | undefined;

            if (createContext?.detailQueryKey) {
              queryClient.setQueryData(createContext.detailQueryKey, createContext.previousDetail);
              queryClient.invalidateQueries({ queryKey: createContext.detailQueryKey });
            }

            if (createContext?.previousRecipeLists) {
              restoreRecipeLists(queryClient, createContext.previousRecipeLists);
            }

            invalidate();
          }
        },
      });
    };

    const updateRecipe = (id: string, input: FullRecipeUpdateDTO): void => {
      updateMutation.mutate(
        { id, version: input.version ?? 1, data: input },
        {
          onError: (error, _variables, context) => {
            onError?.(error, "update");

            if (shouldPreserve(error)) {
              return;
            }

            const updateContext = context as UpdateMutationContext | undefined;

            if (updateContext?.detailQueryKey) {
              queryClient.setQueryData(updateContext.detailQueryKey, updateContext.previousDetail);
              queryClient.invalidateQueries({ queryKey: updateContext.detailQueryKey });
            }

            invalidate();
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
