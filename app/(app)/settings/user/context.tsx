"use client";

import type { User } from "@/types";
import type { ApiKeyMetadataDto } from "@/server/trpc/routers/user/types";

import { createContext, useContext, ReactNode, useCallback } from "react";
import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUserSettingsQuery } from "@/hooks/user/use-user-query";
import { useUserMutations } from "@/hooks/user/use-user-mutations";
import { useUserContext } from "@/context/user-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";

type UserSettingsContextType = {
  user: User | null;
  apiKeys: ApiKeyMetadataDto[];
  allergies: string[];
  isLoading: boolean;

  // Actions
  updateName: (name: string) => Promise<void>;
  updateImage: (file: File) => Promise<void>;
  deleteImage: () => Promise<void>;
  generateApiKey: (name?: string) => Promise<{ key: string; metadata: ApiKeyMetadataDto }>;
  deleteApiKey: (keyId: string) => void;
  toggleApiKey: (keyId: string, enabled: boolean) => void;
  deleteAccount: () => void;
  updateAllergies: (allergies: string[]) => Promise<void>;

  // Loading states
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isDeletingAccount: boolean;
  isUpdatingAllergies: boolean;
};

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const tErrors = useTranslations("common.errors");
  const { user, apiKeys, allergies, isLoading } = useUserSettingsQuery();
  const mutations = useUserMutations();
  const { setUser } = useUserContext();

  const showSettingsError = useCallback(
    (error: unknown, context: string) => {
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context,
      });
    },
    [tErrors]
  );

  const updateName = useCallback(
    async (name: string) => {
      if (!name.trim()) {
        addToast({
          title: tErrors("nameCannotBeEmpty"),
          color: "danger",
          shouldShowTimeoutProgress: true,
          radius: "full",
        });

        return;
      }

      try {
        const result = await mutations.updateName(name);

        if (result.success && result.user) {
          setUser(result.user);
        } else if (result.error) {
          showSettingsError(result.error, "user-settings:update-name");
        }
      } catch (error) {
        showSettingsError(error, "user-settings:update-name");
      }
    },
    [mutations, setUser, showSettingsError, tErrors]
  );

  const updateImage = useCallback(
    async (file: File) => {
      try {
        const result = await mutations.uploadAvatar(file);

        if (result.success && result.user) {
          setUser(result.user);
        } else if (result.error) {
          showSettingsError(result.error, "user-settings:upload-avatar");
          throw new Error(result.error);
        }
      } catch (error) {
        showSettingsError(error, "user-settings:upload-avatar");
        throw error;
      }
    },
    [mutations, setUser, showSettingsError]
  );

  const generateApiKey = useCallback(
    async (name?: string) => {
      const result = await mutations.createApiKey(name);

      if (result.success && result.key && result.metadata) {
        return { key: result.key, metadata: result.metadata };
      } else {
        const errorMsg = result.error || "Failed to generate API key";

        showSettingsError(errorMsg, "user-settings:create-api-key");
        throw new Error(errorMsg);
      }
    },
    [mutations, showSettingsError]
  );

  const deleteApiKey = useCallback(
    (keyId: string) => {
      mutations.deleteApiKey(keyId).catch((error) => {
        showSettingsError(error, "user-settings:delete-api-key");
      });
    },
    [mutations, showSettingsError]
  );

  const toggleApiKey = useCallback(
    (keyId: string, enabled: boolean) => {
      mutations.toggleApiKey(keyId, enabled).catch((error) => {
        showSettingsError(error, "user-settings:toggle-api-key");
      });
    },
    [mutations, showSettingsError]
  );

  const deleteAccount = useCallback(() => {
    mutations
      .deleteAccount()
      .then((result) => {
        if (result.success) {
          window.location.href = "/login";
        } else if (result.error) {
          showSettingsError(result.error, "user-settings:delete-account");
        }
      })
      .catch((error) => {
        showSettingsError(error, "user-settings:delete-account");
      });
  }, [mutations, showSettingsError]);

  const updateAllergies = useCallback(
    async (newAllergies: string[]) => {
      try {
        await mutations.setAllergies(newAllergies);
      } catch (error) {
        showSettingsError(error, "user-settings:update-allergies");
      }
    },
    [mutations, showSettingsError]
  );

  const deleteImage = useCallback(async () => {
    try {
      const result = await mutations.deleteAvatar();

      if (result.success && result.user) {
        setUser(result.user);
      } else if (result.error) {
        showSettingsError(result.error, "user-settings:delete-avatar");
        throw new Error(result.error);
      }
    } catch (error) {
      showSettingsError(error, "user-settings:delete-avatar");
      throw error;
    }
  }, [mutations, setUser, showSettingsError]);

  return (
    <UserSettingsContext.Provider
      value={{
        user: user || null,
        apiKeys: apiKeys || [],
        allergies: allergies || [],
        isLoading,
        updateName,
        updateImage,
        deleteImage,
        generateApiKey,
        deleteApiKey,
        toggleApiKey,
        deleteAccount,
        updateAllergies,
        isUpdatingName: mutations.isUpdatingName,
        isUploadingAvatar: mutations.isUploadingAvatar,
        isDeletingAvatar: mutations.isDeletingAvatar,
        isDeletingAccount: mutations.isDeletingAccount,
        isUpdatingAllergies: mutations.isUpdatingAllergies,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettingsContext() {
  const context = useContext(UserSettingsContext);

  if (!context) {
    throw new Error("useUserSettingsContext must be used within UserSettingsProvider");
  }

  return context;
}
