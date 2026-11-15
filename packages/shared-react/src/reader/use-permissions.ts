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
import { useReader } from "./use-reader";

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
  canViewRecipe: (ownerId: string) => boolean;
  canEditRecipe: (ownerId: string) => boolean;
  canDeleteRecipe: (ownerId: string) => boolean;
};

/** Whether the Reader may view, edit or delete a recipe of `ownerId`'s. */
export function useRecipePermissions(): RecipePermissions {
  const trpc = useTRPC();
  const readerId = useReader().user?.id;
  const { data: access, isLoading } = useQuery({
    ...trpc.permissions.get.queryOptions(),
    select: (permissions) => {
      const { recipePolicy, householdUserIds, isServerAdmin } =
        normalizePermissionsData(permissions);

      return { recipePolicy, householdUserIds, isServerAdmin };
    },
  });

  return {
    isLoading,
    canViewRecipe: (ownerId) =>
      !!readerId && !!access && selectCanViewRecipe(access, readerId, ownerId),
    canEditRecipe: (ownerId) =>
      !!readerId && !!access && selectCanEditRecipe(access, readerId, ownerId),
    canDeleteRecipe: (ownerId) =>
      !!readerId && !!access && selectCanDeleteRecipe(access, readerId, ownerId),
  };
}

/** Rereads what a policy change can alter; the shell mounts it once. */
export function usePermissionsSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The policy itself, and which recipes the reader may see: the paged lists are infinite
  // queries, so they match by path. Nothing else depends on it.
  const affectedKeys = [
    trpc.permissions.get.queryKey(),
    trpc.recipes.list.pathKey(),
    trpc.library.list.pathKey(),
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
