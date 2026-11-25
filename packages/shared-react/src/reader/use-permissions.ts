"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PermissionsRealtime } from "@norish/shared/contracts/realtime/permissions";

import type { ReaderPermissions } from "./permission-selectors";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import {
  normalizePermissionsData,
  selectCanDeleteRecipe,
  selectCanEditRecipe,
  selectCanViewRecipe,
} from "./permission-selectors";

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
    canViewRecipe: (householdId) => !!access && selectCanViewRecipe(access, householdId),
    canEditRecipe: (householdId) => !!access && selectCanEditRecipe(access, householdId),
    canDeleteRecipe: (householdId) => !!access && selectCanDeleteRecipe(access, householdId),
  };
}

/** Rereads what a policy change can alter; the shell mounts it once. */
export function usePermissionsSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The policy itself, and which recipes the reader may see: the paged lists are infinite
  // queries, so they match by path; the library path also holds Search's Categories and Tags.
  const affectedKeys = [
    trpc.permissions.get.queryKey(),
    trpc.recipes.list.pathKey(),
    trpc.library.pathKey(),
    trpc.cookbooks.recipes.pathKey(),
  ];

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
