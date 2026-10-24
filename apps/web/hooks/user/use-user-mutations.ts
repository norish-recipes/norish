"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { ApiKeyMetadataDto } from "@norish/trpc";

import { useUserCacheHelpers } from "./use-user-cache";

export type UserMutationsResult = {
  // Profile updates
  updateName: (name: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; user?: User; error?: string }>;
  deleteAvatar: () => Promise<{ success: boolean; user?: User; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;

  // API keys
  createApiKey: (
    name?: string
  ) => Promise<{ success: boolean; key?: string; metadata?: ApiKeyMetadataDto; error?: string }>;
  deleteApiKey: (keyId: string) => Promise<{ success: boolean; error?: string }>;
  toggleApiKey: (keyId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;

  // Allergies
  setAllergies: (
    allergies: string[]
  ) => Promise<{ success: boolean; allergies?: string[]; version?: number; error?: string }>;

  // Preferences
  updatePreferences: (
    preferences: Partial<UserPreferencesDto>
  ) => Promise<{ success: boolean; preferences?: UserPreferencesDto; error?: string }>;

  // Loading states
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isDeletingAccount: boolean;
  isCreatingApiKey: boolean;
  isDeletingApiKey: boolean;
  isTogglingApiKey: boolean;
  isUpdatingAllergies: boolean;
  isUpdatingPreferences: boolean;
};

/**
 * Mutations hook for user settings.
 * Similar to admin mutations - uses mutateAsync with cache updates on success.
 */
export function useUserMutations(): UserMutationsResult {
  const trpc = useTRPC();
  const {
    getAllergiesData,
    setUserSettingsData,
    setAllergiesData,
    getUserSettingsData,
    mergeUser,
    mergeUserPreferences,
    invalidate,
  } = useUserCacheHelpers();
  const getCurrentUserVersion = () => getUserSettingsData()?.user.version ?? 1;

  // Profile mutations
  const { mutateAsync: mutateUpdateNameAsync, isPending: isUpdatingName } = useMutation(
    trpc.user.updateName.mutationOptions()
  );
  const { mutateAsync: mutateUploadAvatarAsync, isPending: isUploadingAvatar } = useMutation(
    trpc.user.uploadAvatar.mutationOptions()
  );
  const { mutateAsync: mutateDeleteAvatarAsync, isPending: isDeletingAvatar } = useMutation(
    trpc.user.deleteAvatar.mutationOptions()
  );
  const { mutateAsync: mutateDeleteAccountAsync, isPending: isDeletingAccount } = useMutation(
    trpc.user.deleteAccount.mutationOptions()
  );

  // API key mutations
  const { mutateAsync: mutateCreateApiKeyAsync, isPending: isCreatingApiKey } = useMutation(
    trpc.user.apiKeys.create.mutationOptions()
  );
  const { mutateAsync: mutateDeleteApiKeyAsync, isPending: isDeletingApiKey } = useMutation(
    trpc.user.apiKeys.delete.mutationOptions()
  );
  const { mutateAsync: mutateToggleApiKeyAsync, isPending: isTogglingApiKey } = useMutation(
    trpc.user.apiKeys.toggle.mutationOptions()
  );

  // Allergies mutation
  const { mutateAsync: mutateSetAllergiesAsync, isPending: isUpdatingAllergies } = useMutation(
    trpc.user.setAllergies.mutationOptions()
  );

  // Preferences mutation
  const { mutateAsync: mutateUpdatePreferencesAsync, isPending: isUpdatingPreferences } =
    useMutation(trpc.user.updatePreferences.mutationOptions());

  const failed = (error: unknown) => {
    invalidate();

    return { success: false, error: String(error) };
  };

  // A profile change answers with the user as it now is.
  const settleUser = <T extends { success: boolean; user?: User }>(pending: Promise<T>) =>
    pending
      .then((result) => {
        if (result.success && result.user) mergeUser(result.user);

        return result;
      })
      .catch(failed);

  return {
    // Profile updates
    updateName: (name) =>
      settleUser(mutateUpdateNameAsync({ name, version: getCurrentUserVersion() })),

    uploadAvatar: (file) => {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("version", String(getCurrentUserVersion()));

      return settleUser(mutateUploadAvatarAsync(formData));
    },

    deleteAvatar: () => settleUser(mutateDeleteAvatarAsync({ version: getCurrentUserVersion() })),

    deleteAccount: () =>
      mutateDeleteAccountAsync().catch((error: unknown) => ({
        success: false,
        error: String(error),
      })),

    // API keys
    createApiKey: (name) =>
      mutateCreateApiKeyAsync({ name })
        .then((result) => {
          if (result.success && result.metadata) {
            setUserSettingsData((prev) =>
              prev ? { ...prev, apiKeys: [...prev.apiKeys, result.metadata!] } : prev
            );
          }

          return result;
        })
        .catch(failed),

    deleteApiKey: (keyId) =>
      mutateDeleteApiKeyAsync({ keyId })
        .then((result) => {
          if (result.success) {
            setUserSettingsData((prev) =>
              prev ? { ...prev, apiKeys: prev.apiKeys.filter((k) => k.id !== keyId) } : prev
            );
          }

          return result;
        })
        .catch(failed),

    toggleApiKey: (keyId, enabled) =>
      mutateToggleApiKeyAsync({ keyId, enabled })
        .then((result) => {
          if (result.success) {
            setUserSettingsData((prev) =>
              prev
                ? {
                    ...prev,
                    apiKeys: prev.apiKeys.map((k) => (k.id === keyId ? { ...k, enabled } : k)),
                  }
                : prev
            );
          }

          return result;
        })
        .catch(failed),

    // Allergies
    setAllergies: (allergies) => {
      const currentAllergies = getAllergiesData();

      return mutateSetAllergiesAsync({
        allergies,
        version: currentAllergies?.version ?? 0,
      })
        .then((result) => {
          if (result.success) {
            setAllergiesData(() => ({
              allergies: result.allergies ?? [],
              version: result.version ?? currentAllergies?.version ?? 0,
            }));
            setUserSettingsData((prev) =>
              prev
                ? {
                    ...prev,
                    user: {
                      ...prev.user,
                      version: result.version ?? prev.user.version,
                    },
                  }
                : prev
            );
            // Household and calendar updates are handled via WebSocket subscription (onAllergiesUpdated)
          }

          return result;
        })
        .catch((error: unknown) => ({ success: false, error: String(error) }));
    },

    // Preferences
    updatePreferences: (preferences) => {
      // Save previous for rollback
      const previous = getUserSettingsData();

      // Optimistic update
      mergeUserPreferences(preferences);

      return mutateUpdatePreferencesAsync({
        preferences,
        version: previous?.user.version ?? 1,
      })
        .then((result) => {
          if (!result.success) {
            // Rollback immediately to previous cached value
            setUserSettingsData(() => previous);
            invalidate();
          } else {
            if (result.version) mergeUser({ version: result.version });
            mergeUserPreferences(result.preferences ?? {});
          }

          return result;
        })
        .catch((error: unknown) => {
          // Rollback on error
          setUserSettingsData(() => previous);

          return failed(error);
        });
    },

    // Loading states
    isUpdatingName,
    isUploadingAvatar,
    isDeletingAvatar,
    isDeletingAccount,
    isCreatingApiKey,
    isDeletingApiKey,
    isTogglingApiKey,
    isUpdatingAllergies,
    isUpdatingPreferences,
  };
}
