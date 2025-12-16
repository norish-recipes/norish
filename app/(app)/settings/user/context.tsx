"use client";

import type { User } from "@/types";
import type { ApiKeyMetadataDto } from "@/server/trpc/routers/user/types";

import { createContext, useContext, ReactNode, useCallback } from "react";
import { addToast } from "@heroui/react";

import { useUserSettingsQuery } from "@/hooks/user/use-user-query";
import { useUserMutations } from "@/hooks/user/use-user-mutations";
import { useUserContext } from "@/context/user-context";

type UserSettingsContextType = {
  user: User | null;
  apiKeys: ApiKeyMetadataDto[];
  allergies: string[];
  isLoading: boolean;

  // Actions
  updateName: (name: string) => void;
  updateImage: (file: File) => Promise<void>;
  generateApiKey: (name?: string) => Promise<{ key: string; metadata: ApiKeyMetadataDto }>;
  deleteApiKey: (keyId: string) => void;
  toggleApiKey: (keyId: string, enabled: boolean) => void;
  deleteAccount: () => void;
  updateAllergies: (allergies: string[]) => Promise<void>;

  // Loading states
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAccount: boolean;
  isUpdatingAllergies: boolean;
};

const UserSettingsContext = createContext<UserSettingsContextType | null>(null);

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user, apiKeys, allergies, isLoading } = useUserSettingsQuery();
  const mutations = useUserMutations();
  const { setUser } = useUserContext();

  const updateName = useCallback(
    (name: string) => {
      if (!name.trim()) {
        addToast({
          title: "Name cannot be empty",
          color: "danger",
        });

        return;
      }

      mutations
        .updateName(name)
        .then((result) => {
          if (result.success && result.user) {
            setUser(result.user);
          } else if (result.error) {
            addToast({
              title: "Failed to update profile",
              description: result.error,
              color: "danger",
            });
          }
        })
        .catch((error) => {
          addToast({
            title: "Failed to update profile",
            description: (error as Error).message,
            color: "danger",
          });
        });
    },
    [mutations, setUser]
  );

  const updateImage = useCallback(
    async (file: File) => {
      try {
        const result = await mutations.uploadAvatar(file);

        if (result.success && result.user) {
          setUser(result.user);
        } else if (result.error) {
          addToast({
            title: "Failed to upload image",
            description: result.error,
            color: "danger",
          });
          throw new Error(result.error);
        }
      } catch (error) {
        addToast({
          title: "Failed to upload image",
          description: (error as Error).message,
          color: "danger",
        });
        throw error;
      }
    },
    [mutations, setUser]
  );

  const generateApiKey = useCallback(
    async (name?: string) => {
      const result = await mutations.createApiKey(name);

      if (result.success && result.key && result.metadata) {
        return { key: result.key, metadata: result.metadata };
      } else {
        const errorMsg = result.error || "Failed to generate API key";

        addToast({
          title: "Failed to generate API key",
          description: errorMsg,
          color: "danger",
        });
        throw new Error(errorMsg);
      }
    },
    [mutations]
  );

  const deleteApiKey = useCallback(
    (keyId: string) => {
      mutations.deleteApiKey(keyId).catch((error) => {
        addToast({
          title: "Failed to delete API key",
          description: (error as Error).message,
          color: "danger",
        });
      });
    },
    [mutations]
  );

  const toggleApiKey = useCallback(
    (keyId: string, enabled: boolean) => {
      mutations.toggleApiKey(keyId, enabled).catch((error) => {
        addToast({
          title: `Failed to ${enabled ? "enable" : "disable"} API key`,
          description: (error as Error).message,
          color: "danger",
        });
      });
    },
    [mutations]
  );

  const deleteAccount = useCallback(() => {
    mutations
      .deleteAccount()
      .then((result) => {
        if (result.success) {
          window.location.href = "/login";
        } else if (result.error) {
          addToast({
            title: "Failed to delete account",
            description: result.error,
            color: "danger",
          });
        }
      })
      .catch((error) => {
        addToast({
          title: "Failed to delete account",
          description: (error as Error).message,
          color: "danger",
        });
      });
  }, [mutations]);

  const updateAllergies = useCallback(
    async (newAllergies: string[]) => {
      try {
        await mutations.setAllergies(newAllergies);
      } catch (error) {
        addToast({
          title: "Failed to update allergies",
          description: (error as Error).message,
          color: "danger",
        });
      }
    },
    [mutations]
  );

  return (
    <UserSettingsContext.Provider
      value={{
        user: user || null,
        apiKeys: apiKeys || [],
        allergies: allergies || [],
        isLoading,
        updateName,
        updateImage,
        generateApiKey,
        deleteApiKey,
        toggleApiKey,
        deleteAccount,
        updateAllergies,
        isUpdatingName: mutations.isUpdatingName,
        isUploadingAvatar: mutations.isUploadingAvatar,
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
