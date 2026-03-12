"use client";

import type { QueryKey } from "@tanstack/react-query";
import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";


export type HouseholdData = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string;
};

export type HouseholdQueryResult = {
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null;
  currentUserId: string | undefined;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setHouseholdData: (
    updater: (prev: HouseholdData | undefined) => HouseholdData | undefined
  ) => void;
  invalidate: () => void;
};

export function useHouseholdQuery(): HouseholdQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.households.get.queryKey();

  const { data, error, isLoading } = useQuery(trpc.households.get.queryOptions());

  const household = data?.household ?? null;
  const currentUserId = data?.currentUserId;

  const setHouseholdData = (
    updater: (prev: HouseholdData | undefined) => HouseholdData | undefined
  ) => {
    queryClient.setQueryData<HouseholdData>(queryKey, updater);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    household,
    currentUserId,
    error,
    isLoading,
    queryKey,
    setHouseholdData,
    invalidate,
  };
}
