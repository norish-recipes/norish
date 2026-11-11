"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  FullRecipeDTO,
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  MeasurementSystem,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";
import { uploadForm } from "@norish/shared/lib/upload-form";

import type { InfiniteRecipeData } from "./library-cache";
import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { useTRPC } from "../trpc";
import {
  OPTIMISTIC_PENDING_RECIPE_PREFIX,
  removeRecipesFromLists,
  useRecipesCacheHelpers,
} from "./use-recipes-cache";

type ImportMutationContext = {
  optimisticPendingId: string;
};

type CreateMutationContext = {
  recipeId?: string;
  detailQueryKey?: QueryKey;
  previousDetail?: FullRecipeDTO | null | undefined;
};

type DeleteMutationContext = {
  previousDetails: [QueryKey, FullRecipeDTO | null | undefined][];
  previousRecipeLists: [QueryKey, InfiniteRecipeData | undefined][];
};

type UpdateMutationContext = {
  detailQueryKey: QueryKey;
  previousDetail: FullRecipeDTO | null | undefined;
};

function createOptimisticPendingRecipeId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- a placeholder id needs to be unique, not unpredictable
  return `${OPTIMISTIC_PENDING_RECIPE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      // eslint-disable-next-line sonarjs/pseudo-random -- fallback where Web Crypto is missing; the id needs to be unique, not unpredictable
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // Fixed length 16, so both indexes exist.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

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
    servings: input.servings ?? 1,
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    totalMinutes: input.totalMinutes ?? null,
    calories: input.calories ?? null,
    fat: input.fat ?? null,
    carbs: input.carbs ?? null,
    protein: input.protein ?? null,
    systemUsed,
    // Recipe Provenance is never supplied at creation: it is inferred later, or
    // typed in the recipe form afterwards.
    originCountry: input.originCountry ?? null,
    originCountryName: input.originCountryName ?? null,
    originRegion: input.originRegion ?? null,
    provenanceNote: input.provenanceNote ?? null,
    cuisines: [],
    originalSystem: null,
    dishColor: null,
    createdAt: now,
    updatedAt: now,
    tags: (input.tags ?? []).map((tag) => ({ name: tag.name, version: 1 })),
    categories: input.categories ?? [],
    recipeIngredients: optimisticIngredients(input.recipeIngredients ?? [], systemUsed),
    steps: optimisticSteps(input.steps ?? [], systemUsed),
    author: undefined,
    images: optimisticImages(input.images ?? []),
    videos: optimisticVideos(input.videos ?? []),
    version: 1,
  };
}

// The row shapes a create or an update sends, made whole for the cache: an
// optimistic row needs an id and every field the detail view reads.
function optimisticIngredients(
  rows: NonNullable<FullRecipeUpdateDTO["recipeIngredients"]>,
  systemUsed: MeasurementSystem
): FullRecipeDTO["recipeIngredients"] {
  return rows.map((ingredient, index) => ({
    id: ingredient.id ?? createOptimisticId(),
    ingredientId: ingredient.ingredientId ?? null,
    ingredientName: ingredient.ingredientName ?? "",
    amount: toNullableNumber(ingredient.amount),
    unit: ingredient.unit ?? null,
    order: toNumber(ingredient.order, index),
    systemUsed: ingredient.systemUsed ?? systemUsed,
    version: ingredient.version ?? 1,
  }));
}

function optimisticSteps(
  rows: NonNullable<FullRecipeUpdateDTO["steps"]>,
  systemUsed: MeasurementSystem
): FullRecipeDTO["steps"] {
  return rows.map((step, index) => ({
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
    stepIngredients: (step.stepIngredients ?? []).map((ref, refIndex) => ({
      ingredientOrder: toNumber(ref.ingredientOrder),
      share: toNumber(ref.share, 1),
      order: toNumber(ref.order, refIndex),
    })),
  }));
}

function optimisticImages(
  rows: NonNullable<FullRecipeUpdateDTO["images"]>
): FullRecipeDTO["images"] {
  return rows.map((image) => ({
    id: image.id ?? createOptimisticId(),
    image: image.image,
    order: toNumber(image.order),
    generated: image.generated ?? false,
    version: image.version ?? 1,
  }));
}

function optimisticVideos(
  rows: NonNullable<FullRecipeUpdateDTO["videos"]>
): FullRecipeDTO["videos"] {
  return rows.map((video) => ({
    id: video.id ?? createOptimisticId(),
    video: video.video,
    thumbnail: video.thumbnail ?? null,
    duration: toNullableNumber(video.duration),
    order: toNumber(video.order),
    version: video.version ?? 1,
  }));
}

function createOptimisticDashboardRecipe(recipe: FullRecipeDTO): RecipeDashboardDTO {
  return {
    id: recipe.id,
    userId: recipe.userId,
    name: recipe.name,
    description: recipe.description,
    notes: recipe.notes,
    url: recipe.url,
    image: primaryRecipeImage(recipe),
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    calories: recipe.calories,
    // The dashboard flies the origin flag, so the optimistic card has to carry
    // the country too — otherwise a just-created recipe loses its flag until
    // the list refetches.
    originCountry: recipe.originCountry,
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
  /** Delete recipes, each at the version the reader saw; one call however many. */
  deleteRecipes: (recipes: Array<{ id: string; version: number }>) => void;
  convertMeasurements: (recipeId: string, system: MeasurementSystem, version: number) => void;
};

export type RecipesMutationErrorHandler = (error: unknown, operation: string) => void;
/**
 * Told when an import found a recipe the household already holds. Not an
 * error — the id is the one the caller was reaching for, so an app can offer
 * to open it.
 */
export type RecipeAlreadyExistsAdapter = (recipeId: string) => void;

export function useRecipesMutations(
  onError?: RecipesMutationErrorHandler,
  onRecipeAlreadyExists?: RecipeAlreadyExistsAdapter
): RecipesMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    addPendingRecipe,
    replacePendingRecipe,
    removePendingRecipe,
    setAllRecipesData,
    invalidate,
  } = useRecipesCacheHelpers();

  const recipesPath = [trpc.recipes.list.queryKey({})[0]];

  const importMutation = useMutation(
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
  const { mutate: mutateImport } = importMutation;
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
  const { mutate: mutatePasteImport } = pasteImportMutation;
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

        queryClient.setQueryData<FullRecipeDTO | null>(detailQueryKey, optimisticRecipe);
        setAllRecipesData((previousData) =>
          addRecipeToLists(previousData, createOptimisticDashboardRecipe(optimisticRecipe))
        );

        return { recipeId: optimisticRecipe.id, detailQueryKey, previousDetail };
      },
      onError: (error, _variables, context) => {
        onError?.(error, "create");

        if (!shouldPreserveOptimisticUpdate(error)) {
          const createContext = context as CreateMutationContext | undefined;

          const { detailQueryKey, previousDetail } = createContext ?? {};

          // Setting undefined is a no-op, so a detail that was not there is removed.
          if (detailQueryKey && previousDetail === undefined) {
            queryClient.removeQueries({ queryKey: detailQueryKey, exact: true });
          } else if (detailQueryKey) {
            queryClient.setQueryData(detailQueryKey, previousDetail);
            queryClient.invalidateQueries({ queryKey: detailQueryKey });
          }

          // Its own row only: a snapshot would bring back an overlapping create's row.
          const { recipeId } = createContext ?? {};

          if (recipeId) {
            setAllRecipesData((previousData) =>
              removeRecipesFromLists(previousData, new Set([recipeId]))
            );
          }

          invalidate();
        }
      },
    })
  );
  const { mutate: mutateCreate } = createMutation;
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
            recipeIngredients: data.recipeIngredients
              ? optimisticIngredients(data.recipeIngredients, previous.systemUsed)
              : previous.recipeIngredients,
            steps: data.steps ? optimisticSteps(data.steps, previous.systemUsed) : previous.steps,
            // The form sends cuisine ids; the cache holds the entries. A removal
            // shows at once, an addition when the server answers.
            cuisines: data.cuisines
              ? previous.cuisines.filter((cuisine) => data.cuisines?.includes(cuisine.id))
              : previous.cuisines,
            tags: data.tags
              ? data.tags.map(({ name }) => ({
                  name,
                  version: previous.tags.find((tag) => tag.name === name)?.version ?? 1,
                }))
              : previous.tags,
            images: data.images ? optimisticImages(data.images) : previous.images,
            videos: data.videos ? optimisticVideos(data.videos) : previous.videos,
          };
        });

        return { detailQueryKey, previousDetail };
      },
      onError: (error, _variables, context) => {
        onError?.(error, "update");

        if (shouldPreserveOptimisticUpdate(error)) {
          return;
        }

        const updateContext = context as UpdateMutationContext | undefined;

        if (updateContext?.detailQueryKey) {
          queryClient.setQueryData(updateContext.detailQueryKey, updateContext.previousDetail);
          queryClient.invalidateQueries({ queryKey: updateContext.detailQueryKey });
        }

        invalidate();
      },
    })
  );
  const { mutate: mutateUpdate } = updateMutation;
  const deleteMutation = useMutation(
    trpc.recipes.delete.mutationOptions({
      onMutate: async ({ recipes }) => {
        const ids = new Set(recipes.map((recipe) => recipe.id));
        const detailQueryKeys = [...ids].map((id) => trpc.recipes.get.queryKey({ id }));

        await Promise.all([
          queryClient.cancelQueries({ queryKey: recipesPath }),
          ...detailQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
        ]);

        const previousRecipeLists = queryClient.getQueriesData<InfiniteRecipeData>({
          queryKey: recipesPath,
        });
        const previousDetails = detailQueryKeys.map(
          (queryKey) =>
            [queryKey, queryClient.getQueryData<FullRecipeDTO | null>(queryKey)] as [
              QueryKey,
              FullRecipeDTO | null | undefined,
            ]
        );

        setAllRecipesData((previousData) => removeRecipesFromLists(previousData, ids));

        for (const queryKey of detailQueryKeys) {
          queryClient.setQueryData<FullRecipeDTO | null>(queryKey, null);
        }

        return { previousDetails, previousRecipeLists };
      },
      // A recipe skipped or kept left the lists tentatively; refetching brings it back.
      onSuccess: ({ deletedIds }, { recipes }) => {
        const deleted = new Set(deletedIds);
        const survivors = recipes.filter((recipe) => !deleted.has(recipe.id));

        if (survivors.length === 0) return;
        invalidate();
        for (const { id } of survivors) {
          void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
        }
      },
      onError: (error, _variables, context) => {
        onError?.(error, "delete");

        if (shouldPreserveOptimisticUpdate(error)) {
          return;
        }

        restoreDeletedRecipes(context);
        invalidate();

        for (const [queryKey] of context?.previousDetails ?? []) {
          queryClient.invalidateQueries({ queryKey });
        }
      },
    })
  );
  const { mutate: mutateDelete } = deleteMutation;
  const { mutate: mutateConvert } = useMutation(
    trpc.recipes.convertMeasurements.mutationOptions({
      onError: (error) => {
        onError?.(error, "convertMeasurements");

        if (!shouldPreserveOptimisticUpdate(error)) {
          invalidate();
        }
      },
    })
  );

  const restoreDeletedRecipes = (context: DeleteMutationContext | undefined): void => {
    if (!context) {
      return;
    }

    restoreRecipeLists(queryClient, context.previousRecipeLists);

    for (const [queryKey, detail] of context.previousDetails) {
      queryClient.setQueryData<FullRecipeDTO | null | undefined>(queryKey, detail);
    }
  };

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

  const importRecipe = (url: string): void => {
    mutateImport({ url });
  };

  const importRecipeWithAI = (url: string): void => {
    mutateImport({ url, forceAI: true });
  };

  const createRecipe = (input: FullRecipeInsertDTO): void => {
    mutateCreate(input);
  };

  const updateRecipe = (id: string, input: FullRecipeUpdateDTO): void => {
    mutateUpdate({ id, version: input.version ?? 1, data: input });
  };

  const deleteRecipes = (recipes: Array<{ id: string; version: number }>): void => {
    if (recipes.length > 0) mutateDelete({ recipes });
  };

  const convertMeasurements = (
    recipeId: string,
    targetSystem: MeasurementSystem,
    version: number
  ): void => {
    mutateConvert({ recipeId, targetSystem, version });
  };

  const importRecipeFromImages = (files: File[]): void => {
    mutateImageImport(uploadForm(Object.fromEntries(files.map((file, i) => [`file${i}`, file]))));
  };

  const importRecipeFromPaste = (text: string): void => {
    mutatePasteImport({ text });
  };

  const importRecipeFromPasteWithAI = (text: string): void => {
    mutatePasteImport({ text, forceAI: true });
  };

  return {
    importRecipe,
    importRecipeWithAI,
    importRecipeFromImages,
    importRecipeFromPaste,
    importRecipeFromPasteWithAI,
    createRecipe,
    updateRecipe,
    deleteRecipes,
    convertMeasurements,
  };
}
