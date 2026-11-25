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

import type { InfiniteRecipeData } from "./library-cache";
import type { RecipesMutationErrorHandler } from "./recipes-mutation-error";
import { shouldPreserveOptimisticUpdate } from "../offline/optimistic-updates";
import { usePermissions, useReader } from "../reader";
import { useTRPC } from "../trpc";
import { handleRecipesMutationError } from "./recipes-mutation-error";
import { removeRecipesFromLists, useRecipesCacheHelpers } from "./use-recipes-cache";

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
  /** What this edit put in the cache, if it showed. */
  optimisticDetail: FullRecipeDTO | null | undefined;
};

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

/** The Reader's own recipe, in their household; unknown ids offer nothing until the echo. */
function createOptimisticFullRecipe(
  input: FullRecipeInsertDTO,
  owner: { userId: string; householdId: string }
): FullRecipeDTO | null {
  if (!input.id) {
    return null;
  }

  const now = new Date();
  const systemUsed = input.systemUsed ?? "metric";

  return {
    id: input.id,
    ...owner,
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
    householdId: recipe.householdId,
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

export type SaveCallbacks = { onSaved: () => void; onFailed: (error: unknown) => void };

export type RecipesMutationsResult = {
  createRecipe: (input: FullRecipeInsertDTO) => void;
  /** `after` hears once the save is stored or queued, or that it failed. */
  updateRecipe: (id: string, input: FullRecipeUpdateDTO, after?: SaveCallbacks) => void;
  /** Delete recipes, each at the version the reader saw; one call however many. */
  deleteRecipes: (recipes: Array<{ id: string; version: number }>) => void;
  convertMeasurements: (recipeId: string, system: MeasurementSystem, version: number) => void;
};

export function useRecipesMutations(onError?: RecipesMutationErrorHandler): RecipesMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setAllRecipesData, invalidate } = useRecipesCacheHelpers();

  const recipesPath = [trpc.recipes.list.queryKey({})[0]];
  const owner = {
    userId: useReader().user?.id ?? "",
    householdId: usePermissions((permissions) => permissions.householdId) ?? "",
  };

  const createMutation = useMutation(
    trpc.recipes.create.mutationOptions({
      onMutate: async (input) => {
        const optimisticRecipe = createOptimisticFullRecipe(input, owner);

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
        handleRecipesMutationError(error, "create", onError, () => {
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
        });
      },
    })
  );
  const { mutate: mutateCreate } = createMutation;

  type UpdateVariables = { id: string; version: number };
  // The other edits of this recipe still waiting for an answer.
  const otherPendingEdits = (variables: UpdateVariables) =>
    queryClient.getMutationCache().findAll({
      mutationKey: trpc.recipes.update.mutationKey(),
      status: "pending",
      predicate: ({ state }) =>
        state.variables !== variables &&
        (state.variables as UpdateVariables | undefined)?.id === variables.id,
    });

  // Back to the recipe before this edit, then the server's; with other edits waiting, once they
  // settle. A queued one keeps what it shows, and Recovery refetches after Replay sends it.
  const rollBackEdit = (variables: UpdateVariables, context: unknown) => {
    const { detailQueryKey, previousDetail, optimisticDetail } = (context ??
      {}) as Partial<UpdateMutationContext>;
    const others = otherPendingEdits(variables);

    if (others.length > 0) {
      const stopWaiting = queryClient.getMutationCache().subscribe(() => {
        if (others.some(({ state }) => state.status === "pending")) return;
        stopWaiting();
        if (!others.some(({ state }) => shouldPreserveOptimisticUpdate(state.error))) {
          void queryClient.invalidateQueries({
            queryKey: trpc.recipes.get.queryKey({ id: variables.id }),
          });
        } else if (
          detailQueryKey &&
          optimisticDetail &&
          queryClient.getQueryData(detailQueryKey) === optimisticDetail
        ) {
          queryClient.setQueryData(detailQueryKey, previousDetail);
        }
      });

      return false;
    }
    if (detailQueryKey) {
      queryClient.setQueryData(detailQueryKey, previousDetail);
      void queryClient.invalidateQueries({ queryKey: detailQueryKey });
    }

    return true;
  };

  const updateMutation = useMutation(
    trpc.recipes.update.mutationOptions({
      onMutate: async ({ id, version, data }) => {
        const detailQueryKey = trpc.recipes.get.queryKey({ id });

        await queryClient.cancelQueries({ queryKey: detailQueryKey });

        const previousDetail = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);
        let shown = false;

        const written = queryClient.setQueryData<FullRecipeDTO | null | undefined>(
          detailQueryKey,
          (previous) => {
            // An edit made on a version the cache has moved past is refused; it is never shown.
            if (!previous || previous.version !== version) return previous;
            shown = true;

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
          }
        );

        return { detailQueryKey, previousDetail, optimisticDetail: shown ? written : undefined };
      },
      // Stored: the next write from the cache (an edit, a convert) is sent at that version.
      // Refused: the Outbox parks it as Conflicted and tells the reader.
      onSuccess: (answer, variables, context) => {
        if (answer.stale) {
          rollBackEdit(variables, context);

          return;
        }
        const { version } = answer;

        if (version === null) return;
        const { detailQueryKey, optimisticDetail } = context;
        const cached = queryClient.getQueryData<FullRecipeDTO | null>(detailQueryKey);

        // Only on this edit's own state: other content (a refetch, a later edit) is read again.
        if (!optimisticDetail || cached !== optimisticDetail) {
          void queryClient.invalidateQueries({ queryKey: detailQueryKey });
        } else if (optimisticDetail.version < version) {
          queryClient.setQueryData(detailQueryKey, { ...optimisticDetail, version });
        }
      },
      onError: (error, variables, context) => {
        handleRecipesMutationError(error, "update", onError, () => {
          if (rollBackEdit(variables, context)) invalidate();
        });
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
        handleRecipesMutationError(error, "delete", onError, () => {
          restoreDeletedRecipes(context);
          invalidate();

          for (const [queryKey] of context?.previousDetails ?? []) {
            queryClient.invalidateQueries({ queryKey });
          }
        });
      },
    })
  );
  const { mutate: mutateDelete } = deleteMutation;
  const { mutate: mutateConvert } = useMutation(
    trpc.recipes.convertMeasurements.mutationOptions({
      onError: (error) => {
        handleRecipesMutationError(error, "convertMeasurements", onError, invalidate);
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

  const createRecipe = (input: FullRecipeInsertDTO): void => {
    mutateCreate(input);
  };

  const updateRecipe = (id: string, input: FullRecipeUpdateDTO, after?: SaveCallbacks): void => {
    mutateUpdate(
      { id, version: input.version ?? 1, data: input },
      after && {
        onSuccess: after.onSaved,
        onError: (error) =>
          shouldPreserveOptimisticUpdate(error) ? after.onSaved() : after.onFailed(error),
      }
    );
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

  return {
    createRecipe,
    updateRecipe,
    deleteRecipes,
    convertMeasurements,
  };
}
