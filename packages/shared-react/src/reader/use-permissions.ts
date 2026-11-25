"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PermissionsRealtime } from "@norish/shared/contracts/realtime/permissions";

import type { ReaderPermissions } from "./permission-selectors";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { normalizePermissionsData, selectAllows } from "./permission-selectors";

const DEFAULTS = normalizePermissionsData(undefined);

/**
 * One slice of what the Reader may do, so a reader of one permission doesn't render for another.
 * The conservative defaults answer until the server has.
 */
export function usePermissions<T>(select: (permissions: ReaderPermissions) => T): T {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.permissions.get.queryOptions(),
    select: (permissions) => select(normalizePermissionsData(permissions)),
  });

  return data === undefined ? select(DEFAULTS) : data;
}

type RecipePermissions = {
  /** Until the server has answered, every check below says no. */
  isLoading: boolean;
  canViewRecipe: (householdId: string) => boolean;
  canEditRecipe: (householdId: string) => boolean;
  canDeleteRecipe: (householdId: string) => boolean;
};

/** Whether the Reader may view, edit or delete a recipe or cookbook of `householdId`. */
export function useRecipePermissions(): RecipePermissions {
  const trpc = useTRPC();
  const { data: access, isLoading } = useQuery({
    ...trpc.permissions.get.queryOptions(),
    select: (permissions) => {
      const { recipePolicy, householdId } = normalizePermissionsData(permissions);

      return { recipePolicy, householdId };
    },
  });

  return {
    isLoading,
    canViewRecipe: (householdId) => !!access && selectAllows(access, "view", householdId),
    canEditRecipe: (householdId) => !!access && selectAllows(access, "edit", householdId),
    canDeleteRecipe: (householdId) => !!access && selectAllows(access, "delete", householdId),
  };
}

/** Every read the Permission Policy or the household's members decide: recipes, cookbooks and
 * what refers to them (Library, favourites, ratings, plan, groceries, Tags), and the policy. */
export function readerScopedKeys(trpc: ReturnType<typeof useTRPC>): QueryKey[] {
  return [
    trpc.permissions.get.queryKey(),
    trpc.recipes.pathKey(),
    trpc.cookbooks.pathKey(),
    trpc.library.pathKey(),
    trpc.favorites.pathKey(),
    trpc.ratings.pathKey(),
    trpc.calendar.pathKey(),
    trpc.groceries.pathKey(),
    trpc.config.tags.queryKey(),
  ];
}

/** Rereads what a policy change can alter; the shell mounts it once. */
export function usePermissionsSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const affectedKeys = readerScopedKeys(trpc);

  useRealtimeSubscription<PayloadOf<PermissionsRealtime, "policyUpdated">>(
    trpc.permissions.onPolicyUpdated,
    {
      onEvent: () => {
        for (const key of affectedKeys) void queryClient.invalidateQueries({ queryKey: key });
      },
      liveQueryKeys: affectedKeys,
    }
  );
}
