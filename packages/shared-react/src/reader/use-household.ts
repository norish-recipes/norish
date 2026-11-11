"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import { useTRPC } from "../trpc";

export type HouseholdData = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string;
};

export type HouseholdResult = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  /** Whether the Reader administers their household. */
  isAdmin: boolean;
  error: unknown;
  isLoading: boolean;
};

type HouseholdUpdater = (prev: HouseholdData | undefined) => HouseholdData | undefined;

export type HouseholdCacheHelpers = {
  setHouseholdData: (updater: HouseholdUpdater) => void;
  invalidate: () => void;
  invalidateUserSettings: () => void;
  invalidateRecipes: () => void;
};

/** The Reader's household, or null outside one. */
export function useHousehold(): HouseholdResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.households.get.queryOptions());
  const household = data?.household ?? null;

  return {
    household,
    currentUserId: data?.currentUserId,
    isAdmin: household?.users.some((u) => u.id === data?.currentUserId && u.isAdmin) ?? false,
    error,
    isLoading,
  };
}

/** Writes to the cached household and what depends on it, without reading it. */
export function useHouseholdCacheHelpers(): HouseholdCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.households.get.queryKey();

  return {
    setHouseholdData: (updater) => {
      queryClient.setQueryData<HouseholdData>(queryKey, updater);
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    invalidateUserSettings: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.user.get.queryKey() });
    },
    // Every recipe page: only it draws the author's profile.
    invalidateRecipes: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.recipes.get.pathKey() });
    },
  };
}
