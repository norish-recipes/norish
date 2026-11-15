"use client";

import { useQueryClient } from "@tanstack/react-query";

import type { FullRecipeDTO, RecipeDashboardDTO } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";
import {
  NO_RECIPE_FOUND_REASON,
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";
import { patchDashboardRecipeFromFull } from "@norish/shared/contracts/zod";

import type { InfiniteRecipeData } from "./library-cache";
import { usePlatform } from "../platform/platform";
import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { useRecipeSelection } from "./selection-store";
import { removeRecipesFromLists, useRecipesCacheHelpers } from "./use-recipes-cache";

type Payload<E extends EventName<RecipesRealtime>> = PayloadOf<RecipesRealtime, E>;

/** The server reasons a person can act on, each with its translation. */
const TRANSLATED_REASONS: Record<string, string> = {
  [NOT_A_RECIPE_REASON]: "recipes.toasts.notARecipe",
  [NO_RECIPE_FOUND_REASON]: "recipes.toasts.notARecipe",
  [PRIVATE_ADDRESS_REASON]: "recipes.toasts.privateAddress",
};

function readToastMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.message === "string") return candidate.message;
  if (typeof candidate.description === "string") return candidate.description;

  return undefined;
}

/** Put new recipes at the top of a cached list, each once. */
function prependRecipes(recipes: RecipeDashboardDTO[]) {
  return (prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
    if (!prev?.pages?.length) {
      return {
        pages: [{ recipes, total: recipes.length, nextCursor: null }],
        pageParams: [0],
      };
    }

    const firstPage = prev.pages[0];

    if (!firstPage) return prev;

    const existingIds = new Set(firstPage.recipes.map((r) => r.id));
    const newRecipes = recipes.filter((r) => !existingIds.has(r.id));

    if (newRecipes.length === 0) return prev;

    return {
      ...prev,
      pages: [
        {
          ...firstPage,
          recipes: [...newRecipes, ...firstPage.recipes],
          total: firstPage.total + newRecipes.length,
        },
        ...prev.pages.slice(1),
      ],
    };
  };
}

/** The reads both hooks' events patch or invalidate: every recipe list, detail and pending card. */
function recipeListKeys(trpc: ReturnType<typeof useTRPC>) {
  return [
    trpc.recipes.list.pathKey(),
    trpc.recipes.get.pathKey(),
    trpc.recipes.getPending.queryKey(),
    trpc.library.list.pathKey(),
    trpc.cookbooks.recipes.pathKey(),
  ];
}

/**
 * The outcomes of imports and deletes, which the reader starts on any page, with their toasts:
 * mounted once in the shell. An import takes its pending card and ends in a recipe or a failure.
 */
export function useRecipeOutcomesSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast, navigation } = usePlatform();
  const {
    setAllRecipesData,
    invalidate,
    replaceOldestOptimisticPendingRecipe,
    removePendingRecipe,
  } = useRecipesCacheHelpers();

  // An import that ended before an outcome's subscription was live reaches neither the
  // subscription nor the pending list, so the pending list is reread with the lists.
  const live = { liveQueryKeys: recipeListKeys(trpc) };

  useRealtimeSubscription<Payload<"importStarted">>(trpc.recipes.onImportStarted, {
    ...live,
    onEvent: ({ recipeId, url }) => {
      replaceOldestOptimisticPendingRecipe(recipeId, url);
    },
  });

  useRealtimeSubscription<Payload<"imported">>(trpc.recipes.onImported, {
    ...live,
    onEvent: (payload) => {
      const pendingId = payload.pendingRecipeId ?? payload.recipe.id;

      replaceOldestOptimisticPendingRecipe(pendingId);
      removePendingRecipe(pendingId);
      setAllRecipesData(prependRecipes([payload.recipe]));
      toast.show({
        severity: payload.incomplete ? "warning" : "success",
        title: toast.translate("recipes.toasts.imported"),
        description: payload.incomplete ? toast.translate("recipes.toasts.incomplete") : undefined,
        subject: payload.recipe.name,
        actionLabel: toast.translate("recipes.toasts.view"),
        onActionPress: () => navigation.toRecipe(payload.recipe.id),
      });
    },
  });

  useRealtimeSubscription<Payload<"failed">>(trpc.recipes.onFailed, {
    ...live,
    onEvent: (payload) => {
      if (payload.recipeId) {
        replaceOldestOptimisticPendingRecipe(payload.recipeId);
        removePendingRecipe(payload.recipeId);
      }

      invalidate();
      const reasonKey = payload.reason ? TRANSLATED_REASONS[payload.reason] : undefined;

      toast.show({
        severity: "danger",
        title: toast.translate("common.import.paste.failed"),
        // Server reasons stay in the job monitor; the ones a person can act on are translated.
        description: reasonKey
          ? toast.translate(reasonKey)
          : (readToastMessage(payload) ?? toast.translate("recipes.toasts.failedDescription")),
      });
    },
  });

  useRealtimeSubscription<Payload<"deleteKept">>(trpc.recipes.onDeleteKept, {
    ...live,
    // The kept recipes left the lists tentatively; refetching brings them back.
    onEvent: (payload) => {
      invalidate();
      for (const id of payload.ids) {
        void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      }
      toast.show({
        severity: "warning",
        title: toast.translate("recipes.toasts.deleteKept", { count: payload.ids.length }),
      });
    },
  });
}

/** The Library's list events: recipes created, edited, converted and deleted anywhere. */
export function useRecipeListSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setAllRecipesData, removePendingRecipe } = useRecipesCacheHelpers();
  const dropFromSelection = useRecipeSelection((state) => state.drop);

  const live = { liveQueryKeys: [...recipeListKeys(trpc), trpc.config.categories.queryKey()] };
  // The server saves after the mutation answers, so the household's Categories
  // are reread when the save is announced, not when the mutation succeeds.
  const rereadCategories = () =>
    void queryClient.invalidateQueries({ queryKey: trpc.config.categories.queryKey() });

  const updateRecipeInList = (updatedRecipe: FullRecipeDTO) => {
    setAllRecipesData((prev: InfiniteRecipeData | undefined): InfiniteRecipeData | undefined => {
      if (!prev?.pages) return prev;

      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          recipes: page.recipes.map((r) =>
            r.id === updatedRecipe.id ? patchDashboardRecipeFromFull(r, updatedRecipe) : r
          ),
        })),
      };
    });
  };

  useRealtimeSubscription<Payload<"created">>(trpc.recipes.onCreated, {
    ...live,
    onEvent: ({ recipe }) => {
      removePendingRecipe(recipe.id);
      setAllRecipesData(prependRecipes([recipe]));
      rereadCategories();
    },
  });

  useRealtimeSubscription<Payload<"updated">>(trpc.recipes.onUpdated, {
    ...live,
    onEvent: ({ recipe, source }) => {
      updateRecipeInList(recipe);
      queryClient.setQueryData(trpc.recipes.get.queryKey({ id: recipe.id }), recipe);

      // An enrichment changes no Category.
      if (source !== "enrichment") rereadCategories();
    },
  });

  useRealtimeSubscription<Payload<"deleted">>(trpc.recipes.onDeleted, {
    ...live,
    onEvent: ({ ids }) => {
      setAllRecipesData((prev) => removeRecipesFromLists(prev, new Set(ids)));
      dropFromSelection(ids);
      rereadCategories();

      for (const id of ids) {
        void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.queryKey({ id }) });
      }
    },
  });

  useRealtimeSubscription<Payload<"converted">>(trpc.recipes.onConverted, {
    ...live,
    onEvent: (payload) => {
      updateRecipeInList(payload.recipe);
      void queryClient.invalidateQueries({
        queryKey: trpc.recipes.get.queryKey({ id: payload.recipe.id }),
      });
    },
  });

  useRealtimeSubscription<Payload<"recipeBatchCreated">>(trpc.recipes.onRecipeBatchCreated, {
    ...live,
    onEvent: ({ recipes }) => setAllRecipesData(prependRecipes(recipes)),
  });
}
