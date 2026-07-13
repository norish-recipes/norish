"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { ApiKeyMetadataDto } from "@norish/trpc";
import { shouldPreserveOptimisticUpdate } from "@norish/shared-react/hooks";
import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { getUserPreferences } from "@norish/shared/lib/user-preferences";

import { useUserCacheHelpers } from "./use-user-cache";

type QueuedMutationResult = { queued?: boolean };

export type UserMutationsResult = {
  // Profile updates
  updateName: (
    name: string
  ) => Promise<{ success: boolean; user?: User; error?: string } & QueuedMutationResult>;
  uploadAvatar: (
    file: File
  ) => Promise<{ success: boolean; user?: User; error?: string } & QueuedMutationResult>;
  deleteAvatar: () => Promise<
    { success: boolean; user?: User; error?: string } & QueuedMutationResult
  >;
  deleteAccount: () => Promise<{ success: boolean; error?: string } & QueuedMutationResult>;

  // API keys
  createApiKey: (name?: string) => Promise<
    {
      success: boolean;
      key?: string;
      metadata?: ApiKeyMetadataDto;
      error?: string;
    } & QueuedMutationResult
  >;
  deleteApiKey: (
    keyId: string
  ) => Promise<{ success: boolean; error?: string } & QueuedMutationResult>;
  toggleApiKey: (
    keyId: string,
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string } & QueuedMutationResult>;

  // Allergies
  setAllergies: (allergies: string[]) => Promise<
    {
      success: boolean;
      allergies?: string[];
      version?: number;
      error?: string;
    } & QueuedMutationResult
  >;

  // Preferences
  updatePreferences: (
    preferences: Partial<UserPreferencesDto>
  ) => Promise<
    { success: boolean; preferences?: UserPreferencesDto; error?: string } & QueuedMutationResult
  >;

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

function queuedMutationResult(error: unknown): (QueuedMutationResult & { success: false }) | null {
  return isQueuedDeliveryError(error) ? { success: false, queued: true } : null;
}

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
    invalidate,
  } = useUserCacheHelpers();
  const getCurrentUserVersion = () => getUserSettingsData()?.user.version ?? 1;
  const reconcileError = (error: unknown) => {
    if (!shouldPreserveOptimisticUpdate(error)) invalidate();
  };

  // Profile mutations
  const updateNameMutation = useMutation(trpc.user.updateName.mutationOptions());
  const uploadAvatarMutation = useMutation(trpc.user.uploadAvatar.mutationOptions());
  const deleteAvatarMutation = useMutation(trpc.user.deleteAvatar.mutationOptions());
  const deleteAccountMutation = useMutation(trpc.user.deleteAccount.mutationOptions());

  // API key mutations
  const createApiKeyMutation = useMutation(trpc.user.apiKeys.create.mutationOptions());
  const deleteApiKeyMutation = useMutation(trpc.user.apiKeys.delete.mutationOptions());
  const toggleApiKeyMutation = useMutation(trpc.user.apiKeys.toggle.mutationOptions());

  // Allergies mutation
  const setAllergiesMutation = useMutation(trpc.user.setAllergies.mutationOptions());

  // Preferences mutation
  const updatePreferencesMutation = useMutation(trpc.user.updatePreferences.mutationOptions());

  return {
    // Profile updates
    updateName: async (name) => {
      try {
        const result = await updateNameMutation.mutateAsync({
          name,
          version: getCurrentUserVersion(),
        });

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    uploadAvatar: async (file) => {
      try {
        const formData = new FormData();

        formData.append("file", file);
        formData.append("version", String(getCurrentUserVersion()));

        const result = await uploadAvatarMutation.mutateAsync(formData);

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    deleteAvatar: async () => {
      try {
        const result = await deleteAvatarMutation.mutateAsync({ version: getCurrentUserVersion() });

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    deleteAccount: async () => {
      try {
        const result = await deleteAccountMutation.mutateAsync();

        return result;
      } catch (error) {
        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    // API keys
    createApiKey: async (name) => {
      try {
        const result = await createApiKeyMutation.mutateAsync({ name });

        if (result.success && result.metadata) {
          setUserSettingsData((prev) =>
            prev ? { ...prev, apiKeys: [...prev.apiKeys, result.metadata!] } : prev
          );
        }

        return result;
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    deleteApiKey: async (keyId) => {
      try {
        const result = await deleteApiKeyMutation.mutateAsync({ keyId });

        if (result.success) {
          setUserSettingsData((prev) =>
            prev ? { ...prev, apiKeys: prev.apiKeys.filter((k) => k.id !== keyId) } : prev
          );
        }

        return result;
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    toggleApiKey: async (keyId, enabled) => {
      try {
        const result = await toggleApiKeyMutation.mutateAsync({ keyId, enabled });

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
      } catch (error) {
        reconcileError(error);

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    // Allergies
    setAllergies: async (allergies) => {
      try {
        const currentAllergies = getAllergiesData();
        const result = await setAllergiesMutation.mutateAsync({
          allergies,
          version: currentAllergies?.version ?? 0,
        });

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
      } catch (error) {
        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    // Preferences
    updatePreferences: async (preferences) => {
      // Save previous for rollback
      const previous = getUserSettingsData();

      try {
        // Optimistic update
        setUserSettingsData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            user: {
              ...prev.user,
              preferences: { ...getUserPreferences(prev.user), ...preferences },
            },
          };
        });

        const result = await updatePreferencesMutation.mutateAsync({
          preferences,
          version: previous?.user.version ?? 1,
        });

        if (!result.success) {
          // Rollback immediately to previous cached value
          setUserSettingsData(() => previous);
          invalidate();
        } else {
          setUserSettingsData((prev) =>
            prev
              ? {
                  ...prev,
                  user: {
                    ...prev.user,
                    version: result.version ?? prev.user.version,
                    preferences: { ...getUserPreferences(prev.user), ...result.preferences },
                  },
                }
              : prev
          );
        }

        return result;
      } catch (error) {
        if (!shouldPreserveOptimisticUpdate(error)) {
          // Rollback on an ordinary domain or storage failure.
          setUserSettingsData(() => previous);
          invalidate();
        }

        return queuedMutationResult(error) ?? { success: false, error: String(error) };
      }
    },

    // Loading states
    isUpdatingName: updateNameMutation.isPending,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    isDeletingAvatar: deleteAvatarMutation.isPending,
    isDeletingAccount: deleteAccountMutation.isPending,
    isCreatingApiKey: createApiKeyMutation.isPending,
    isDeletingApiKey: deleteApiKeyMutation.isPending,
    isTogglingApiKey: toggleApiKeyMutation.isPending,
    isUpdatingAllergies: setAllergiesMutation.isPending,
    isUpdatingPreferences: updatePreferencesMutation.isPending,
  };
}
