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
  error: unknown;
  isLoading: boolean;
};

type HouseholdUpdater = (prev: HouseholdData | undefined) => HouseholdData | undefined;

export type HouseholdCacheHelpers = {
  setHouseholdData: (updater: HouseholdUpdater) => void;
  invalidate: () => void;
  invalidateCalendar: () => void;
  invalidateUserSettings: () => void;
  invalidateRecipes: () => void;
};

/** The Reader's household, or null outside one. */
export function useHousehold(): HouseholdResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.households.get.queryOptions());

  return {
    household: data?.household ?? null,
    currentUserId: data?.currentUserId,
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
    invalidateCalendar: () => {
      void queryClient.invalidateQueries({ queryKey: ["calendar", "combined"] });
    },
    invalidateUserSettings: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.user.get.queryKey() });
    },
    // Path-level prefix: catches list and detail queries, whose payloads carry the author's profile.
    invalidateRecipes: () => {
      void queryClient.invalidateQueries({ queryKey: [["recipes"]] });
    },
  };
}
