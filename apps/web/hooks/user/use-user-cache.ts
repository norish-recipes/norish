"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
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
  /** Change only the given fields of the cached user. */
  mergeUser: (patch: Partial<User>) => void;
  /** Change only the given keys of the cached user's preferences document. */
  mergeUserPreferences: (patch: Partial<UserPreferencesDto>) => void;
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

  // Stable keys, so the helpers keep their identity across renders.
  const userQueryKey = useMemo(() => trpc.user.get.queryKey(), [trpc]);
  const allergiesQueryKey = useMemo(() => trpc.user.getAllergies.queryKey(), [trpc]);

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

  const mergeUser = useCallback(
    (patch: Partial<User>) => {
      setUserSettingsData((prev) => (prev ? { ...prev, user: { ...prev.user, ...patch } } : prev));
    },
    [setUserSettingsData]
  );

  const mergeUserPreferences = useCallback(
    (patch: Partial<UserPreferencesDto>) => {
      setUserSettingsData((prev) =>
        prev
          ? {
              ...prev,
              user: { ...prev.user, preferences: { ...prev.user.preferences, ...patch } },
            }
          : prev
      );
    },
    [setUserSettingsData]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: userQueryKey });
  }, [queryClient, userQueryKey]);

  return {
    getUserSettingsData,
    getAllergiesData,
    setUserSettingsData,
    setAllergiesData,
    mergeUser,
    mergeUserPreferences,
    invalidate,
  };
}
