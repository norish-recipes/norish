"use client";

import type {
  AIConfig,
  VideoConfig,
  AuthProviderOIDCInput,
  AuthProviderGitHubInput,
  AuthProviderGoogleInput,
  RecipePermissionPolicy,
  ServerConfigKey,
} from "@/server/db/zodSchemas/server-config";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAdminConfigsQuery } from "./use-admin-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type AdminMutationsResult = {
  // Registration
  updateRegistration: (enabled: boolean) => Promise<{ success: boolean }>;

  // Auth providers (input types - isOverridden is set server-side)
  updateAuthProviderOIDC: (
    config: AuthProviderOIDCInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateAuthProviderGitHub: (
    config: AuthProviderGitHubInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateAuthProviderGoogle: (
    config: AuthProviderGoogleInput
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAuthProvider: (
    type: "oidc" | "github" | "google"
  ) => Promise<{ success: boolean; error?: string }>;
  testAuthProvider: (
    type: "oidc" | "github" | "google",
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;

  // Content config
  updateContentIndicators: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateUnits: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateRecurrenceConfig: (json: string) => Promise<{ success: boolean; error?: string }>;

  // AI & Video
  updateAIConfig: (config: AIConfig) => Promise<{ success: boolean; error?: string }>;
  updateVideoConfig: (config: VideoConfig) => Promise<{ success: boolean; error?: string }>;
  testAIEndpoint: (
    config: Pick<AIConfig, "provider" | "endpoint" | "apiKey">
  ) => Promise<{ success: boolean; error?: string }>;

  // Permissions
  updateRecipePermissionPolicy: (
    policy: RecipePermissionPolicy
  ) => Promise<{ success: boolean; error?: string }>;

  // System
  updateSchedulerMonths: (months: number) => Promise<{ success: boolean; error?: string }>;
  restoreDefault: (key: ServerConfigKey) => Promise<{ success: boolean; error?: string }>;
  restartServer: () => Promise<{ success: boolean }>;

  // Secret fetching
  fetchConfigSecret: (key: ServerConfigKey, field: string) => Promise<string | null>;
};

/**
 * Mutations hook for admin operations.
 * Unlike other features, admin mutations are NOT fire-and-forget.
 * Admins need immediate feedback on validation errors.
 */
export function useAdminMutations(): AdminMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { invalidate } = useAdminConfigsQuery();

  // Registration
  const updateRegistrationMutation = useMutation(trpc.admin.updateRegistration.mutationOptions());

  // Auth providers
  const updateOIDCMutation = useMutation(trpc.admin.auth.updateOIDC.mutationOptions());
  const updateGitHubMutation = useMutation(trpc.admin.auth.updateGitHub.mutationOptions());
  const updateGoogleMutation = useMutation(trpc.admin.auth.updateGoogle.mutationOptions());
  const deleteProviderMutation = useMutation(trpc.admin.auth.deleteProvider.mutationOptions());
  const testProviderMutation = useMutation(trpc.admin.auth.testProvider.mutationOptions());

  // Content config
  const updateContentIndicatorsMutation = useMutation(
    trpc.admin.content.updateContentIndicators.mutationOptions()
  );
  const updateUnitsMutation = useMutation(trpc.admin.content.updateUnits.mutationOptions());
  const updateRecurrenceConfigMutation = useMutation(
    trpc.admin.content.updateRecurrenceConfig.mutationOptions()
  );

  // AI & Video
  const updateAIConfigMutation = useMutation(trpc.admin.updateAIConfig.mutationOptions());
  const updateVideoConfigMutation = useMutation(trpc.admin.updateVideoConfig.mutationOptions());
  const testAIEndpointMutation = useMutation(trpc.admin.testAIEndpoint.mutationOptions());

  // Permissions
  const updatePermissionPolicyMutation = useMutation(
    trpc.admin.updateRecipePermissionPolicy.mutationOptions()
  );

  // System
  const updateSchedulerMonthsMutation = useMutation(
    trpc.admin.updateSchedulerMonths.mutationOptions()
  );
  const restoreDefaultMutation = useMutation(trpc.admin.restoreDefault.mutationOptions());
  const restartServerMutation = useMutation(trpc.admin.restartServer.mutationOptions());

  // Helper to wrap mutation with invalidate on success
  const withInvalidate = async <T extends { success: boolean }>(
    promise: Promise<T>
  ): Promise<T> => {
    const result = await promise;

    if (result.success) {
      invalidate();
    }

    return result;
  };

  return {
    // Registration
    updateRegistration: async (enabled) => {
      return withInvalidate(updateRegistrationMutation.mutateAsync(enabled));
    },

    // Auth providers
    updateAuthProviderOIDC: async (config) => {
      return withInvalidate(updateOIDCMutation.mutateAsync(config));
    },
    updateAuthProviderGitHub: async (config) => {
      return withInvalidate(updateGitHubMutation.mutateAsync(config));
    },
    updateAuthProviderGoogle: async (config) => {
      return withInvalidate(updateGoogleMutation.mutateAsync(config));
    },
    deleteAuthProvider: async (type) => {
      return withInvalidate(deleteProviderMutation.mutateAsync(type));
    },
    testAuthProvider: async (type, config) => {
      // Test doesn't need invalidate
      return testProviderMutation.mutateAsync({ type, config });
    },

    // Content config
    updateContentIndicators: async (json) => {
      return withInvalidate(updateContentIndicatorsMutation.mutateAsync(json));
    },
    updateUnits: async (json) => {
      return withInvalidate(updateUnitsMutation.mutateAsync(json));
    },
    updateRecurrenceConfig: async (json) => {
      return withInvalidate(updateRecurrenceConfigMutation.mutateAsync(json));
    },

    // AI & Video
    updateAIConfig: async (config) => {
      return withInvalidate(updateAIConfigMutation.mutateAsync(config));
    },
    updateVideoConfig: async (config) => {
      return withInvalidate(updateVideoConfigMutation.mutateAsync(config));
    },
    testAIEndpoint: async (config) => {
      // Test doesn't need invalidate
      return testAIEndpointMutation.mutateAsync(config);
    },

    // Permissions
    updateRecipePermissionPolicy: async (policy) => {
      return withInvalidate(updatePermissionPolicyMutation.mutateAsync(policy));
    },

    // System
    updateSchedulerMonths: async (months) => {
      return withInvalidate(updateSchedulerMonthsMutation.mutateAsync(months));
    },
    restoreDefault: async (key) => {
      return withInvalidate(restoreDefaultMutation.mutateAsync(key));
    },
    restartServer: async () => {
      return restartServerMutation.mutateAsync();
    },

    // Secret fetching - use queryClient.fetchQuery for one-off secret retrieval
    fetchConfigSecret: async (key, field) => {
      const result = await queryClient.fetchQuery(
        trpc.admin.getSecretField.queryOptions({ key, field })
      );

      return result.value;
    },
  };
}
