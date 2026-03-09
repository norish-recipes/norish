import { createContext, useCallback, useContext } from "react";

import type { User } from "@norish/shared/contracts";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";
import type { ApiKeyMetadataDto } from "@norish/trpc";

export type UserSettingsContextValue = {
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
  updatePreferences: (preferences: Partial<UserPreferencesDto>) => Promise<void>;

  // Loading states
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isDeletingAccount: boolean;
  isUpdatingAllergies: boolean;
  isUpdatingPreferences: boolean;
};

type UserSettingsQueryResult = {
  user: User | null;
  apiKeys: ApiKeyMetadataDto[];
  allergies: string[];
  isLoading: boolean;
};

type UserMutationsAdapter = {
  updateName: (name: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  uploadAvatar: (file: File) => Promise<{ success: boolean; user?: User; error?: string }>;
  deleteAvatar: () => Promise<{ success: boolean; user?: User; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  createApiKey: (
    name?: string
  ) => Promise<{ success: boolean; key?: string; metadata?: ApiKeyMetadataDto; error?: string }>;
  deleteApiKey: (keyId: string) => Promise<{ success: boolean; error?: string }>;
  toggleApiKey: (keyId: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  setAllergies: (
    allergies: string[]
  ) => Promise<{ success: boolean; allergies?: string[]; error?: string }>;
  updatePreferences: (
    preferences: Partial<UserPreferencesDto>
  ) => Promise<{ success: boolean; preferences?: UserPreferencesDto; error?: string }>;
  isUpdatingName: boolean;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
  isDeletingAccount: boolean;
  isUpdatingAllergies: boolean;
  isUpdatingPreferences: boolean;
};

type ErrorHandlerAdapter = {
  showError: (error: unknown, context: string) => void;
  showValidationError: (message: string, context: string) => void;
};

type DeleteAccountAdapter = {
  onSuccess: () => void;
};

type CreateUserSettingsContextOptions = {
  useUserSettingsQuery: () => UserSettingsQueryResult;
  useUserMutations: () => UserMutationsAdapter;
  useErrorHandler: () => ErrorHandlerAdapter;
  useDeleteAccountAdapter: () => DeleteAccountAdapter;
};

export function createUserSettingsContext({
  useUserSettingsQuery,
  useUserMutations,
  useErrorHandler,
  useDeleteAccountAdapter,
}: CreateUserSettingsContextOptions) {
  const UserSettingsContext = createContext<UserSettingsContextValue | null>(null);

  function UserSettingsProvider({ children }: { children: React.ReactNode }) {
    const { user, apiKeys, allergies, isLoading } = useUserSettingsQuery();
    const mutations = useUserMutations();
    const errorHandler = useErrorHandler();
    const deleteAccountAdapter = useDeleteAccountAdapter();

    const updateName = useCallback(
      async (name: string) => {
        if (!name.trim()) {
          errorHandler.showValidationError("nameCannotBeEmpty", "user-settings:update-name");

          return;
        }

        try {
          const result = await mutations.updateName(name);

          if (!result.success && result.error) {
            errorHandler.showError(result.error, "user-settings:update-name");
          }
        } catch (error) {
          errorHandler.showError(error, "user-settings:update-name");
        }
      },
      [mutations, errorHandler]
    );

    const updateImage = useCallback(
      async (file: File) => {
        try {
          const result = await mutations.uploadAvatar(file);

          if (!result.success && result.error) {
            errorHandler.showError(result.error, "user-settings:upload-avatar");
            throw new Error(result.error);
          }
        } catch (error) {
          errorHandler.showError(error, "user-settings:upload-avatar");
          throw error;
        }
      },
      [mutations, errorHandler]
    );

    const generateApiKey = useCallback(
      async (name?: string) => {
        const result = await mutations.createApiKey(name);

        if (result.success && result.key && result.metadata) {
          return { key: result.key, metadata: result.metadata };
        } else {
          const errorMsg = result.error || "Failed to generate API key";

          errorHandler.showError(errorMsg, "user-settings:create-api-key");
          throw new Error(errorMsg);
        }
      },
      [mutations, errorHandler]
    );

    const deleteApiKey = useCallback(
      (keyId: string) => {
        mutations.deleteApiKey(keyId).catch((error) => {
          errorHandler.showError(error, "user-settings:delete-api-key");
        });
      },
      [mutations, errorHandler]
    );

    const toggleApiKey = useCallback(
      (keyId: string, enabled: boolean) => {
        mutations.toggleApiKey(keyId, enabled).catch((error) => {
          errorHandler.showError(error, "user-settings:toggle-api-key");
        });
      },
      [mutations, errorHandler]
    );

    const deleteAccount = useCallback(() => {
      mutations
        .deleteAccount()
        .then((result) => {
          if (result.success) {
            deleteAccountAdapter.onSuccess();
          } else if (result.error) {
            errorHandler.showError(result.error, "user-settings:delete-account");
          }
        })
        .catch((error) => {
          errorHandler.showError(error, "user-settings:delete-account");
        });
    }, [mutations, errorHandler, deleteAccountAdapter]);

    const updateAllergies = useCallback(
      async (newAllergies: string[]) => {
        try {
          await mutations.setAllergies(newAllergies);
        } catch (error) {
          errorHandler.showError(error, "user-settings:update-allergies");
        }
      },
      [mutations, errorHandler]
    );

    const updatePreferences = useCallback(
      async (preferences: Partial<UserPreferencesDto>) => {
        try {
          const result = await mutations.updatePreferences(preferences);

          if (!result.success && result.error) {
            errorHandler.showError(result.error, "user-settings:update-preferences");
          }

          return;
        } catch (error) {
          errorHandler.showError(error, "user-settings:update-preferences");
        }
      },
      [mutations, errorHandler]
    );

    const deleteImage = useCallback(async () => {
      try {
        const result = await mutations.deleteAvatar();

        if (!result.success && result.error) {
          errorHandler.showError(result.error, "user-settings:delete-avatar");
          throw new Error(result.error);
        }
      } catch (error) {
        errorHandler.showError(error, "user-settings:delete-avatar");
        throw error;
      }
    }, [mutations, errorHandler]);

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
          updatePreferences,
          isUpdatingName: mutations.isUpdatingName,
          isUploadingAvatar: mutations.isUploadingAvatar,
          isDeletingAvatar: mutations.isDeletingAvatar,
          isDeletingAccount: mutations.isDeletingAccount,
          isUpdatingAllergies: mutations.isUpdatingAllergies,
          isUpdatingPreferences: mutations.isUpdatingPreferences,
        }}
      >
        {children}
      </UserSettingsContext.Provider>
    );
  }

  function useUserSettingsContext(): UserSettingsContextValue {
    const context = useContext(UserSettingsContext);

    if (!context) {
      throw new Error("useUserSettingsContext must be used within UserSettingsProvider");
    }

    return context;
  }

  return {
    UserSettingsProvider,
    useUserSettingsContext,
  };
}
