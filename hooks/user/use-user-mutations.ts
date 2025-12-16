"use client";

import type { User } from "@/types";
import type { ApiKeyMetadataDto } from "@/server/trpc/routers/user/types";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useUserSettingsQuery } from "./use-user-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
  ) => Promise<{ success: boolean; allergies?: string[]; error?: string }>;

  // Loading states
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isDeletingAccount: boolean;
  isCreatingApiKey: boolean;
  isDeletingApiKey: boolean;
  isTogglingApiKey: boolean;
  isUpdatingAllergies: boolean;
};

/**
 * Mutations hook for user settings.
 * Similar to admin mutations - uses mutateAsync with cache updates on success.
 */
export function useUserMutations(): UserMutationsResult {
  const trpc = useTRPC();
  const { setUserSettingsData, invalidate, allergiesQueryKey } = useUserSettingsQuery();
  const queryClient = useQueryClient();

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

  return {
    // Profile updates
    updateName: async (name) => {
      try {
        const result = await updateNameMutation.mutateAsync({ name });

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        invalidate();

        return { success: false, error: String(error) };
      }
    },

    uploadAvatar: async (file) => {
      try {
        const formData = new FormData();

        formData.append("file", file);

        const result = await uploadAvatarMutation.mutateAsync(formData);

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        invalidate();

        return { success: false, error: String(error) };
      }
    },

    deleteAvatar: async () => {
      try {
        const result = await deleteAvatarMutation.mutateAsync();

        if (result.success && result.user) {
          setUserSettingsData((prev) => (prev ? { ...prev, user: result.user! } : prev));
        }

        return result;
      } catch (error) {
        invalidate();

        return { success: false, error: String(error) };
      }
    },

    deleteAccount: async () => {
      try {
        const result = await deleteAccountMutation.mutateAsync();

        return result;
      } catch (error) {
        return { success: false, error: String(error) };
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
        invalidate();

        return { success: false, error: String(error) };
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
        invalidate();

        return { success: false, error: String(error) };
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
        invalidate();

        return { success: false, error: String(error) };
      }
    },

    // Allergies
    setAllergies: async (allergies) => {
      try {
        const result = await setAllergiesMutation.mutateAsync({ allergies });

        if (result.success) {
          queryClient.setQueryData(allergiesQueryKey, { allergies: result.allergies });
        }

        return result;
      } catch (error) {
        queryClient.invalidateQueries({ queryKey: allergiesQueryKey });

        return { success: false, error: String(error) };
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
  };
}
