"use client";

import { useCallback } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { UserSettingsDto } from "@norish/trpc";

export type UserAllergiesData = {
  allergies: string[];
  version: number;
};

export type UserCacheHelpers = {
  getUserSettingsData: () => UserSettingsDto | undefined;
  getAllergiesData: () => UserAllergiesData | undefined;
  setUserSettingsData: (
    updater: (prev: UserSettingsDto | undefined) => UserSettingsDto | undefined
  ) => void;
  setAllergiesData: (
    updater: (prev: UserAllergiesData | undefined) => UserAllergiesData | undefined
  ) => void;
  invalidate: () => void;
};

/**
 * Lightweight cache manipulation helpers for user settings.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in mutation hooks to avoid
 * duplicate observer trees that cause recursion issues.
 *
 * For reading data + subscribing to changes, use useUserSettingsQuery instead.
 */
export function useUserCacheHelpers(): UserCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const userQueryKey = trpc.user.get.queryKey();
  const allergiesQueryKey = trpc.user.getAllergies.queryKey();

  const getUserSettingsData = useCallback(
    () => queryClient.getQueryData<UserSettingsDto>(userQueryKey),
    [queryClient, userQueryKey]
  );

  const setUserSettingsData = useCallback(
    (updater: (prev: UserSettingsDto | undefined) => UserSettingsDto | undefined) => {
      queryClient.setQueryData<UserSettingsDto>(userQueryKey, updater);
    },
    [queryClient, userQueryKey]
  );

  const getAllergiesData = useCallback(
    () => queryClient.getQueryData<UserAllergiesData>(allergiesQueryKey),
    [queryClient, allergiesQueryKey]
  );

  const setAllergiesData = useCallback(
    (updater: (prev: UserAllergiesData | undefined) => UserAllergiesData | undefined) => {
      queryClient.setQueryData<UserAllergiesData>(allergiesQueryKey, updater);
    },
    [queryClient, allergiesQueryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: userQueryKey });
  }, [queryClient, userQueryKey]);

  return {
    getUserSettingsData,
    getAllergiesData,
    setUserSettingsData,
    setAllergiesData,
    invalidate,
  };
}
