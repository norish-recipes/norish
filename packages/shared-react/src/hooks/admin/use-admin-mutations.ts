import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  AIConfig,
  AuthProviderGitHubInput,
  AuthProviderGoogleInput,
  AuthProviderOIDCInput,
  PromptsConfigInput,
  RecipePermissionPolicy,
  ServerConfigKey,
  TimerKeywordsInput,
  VideoConfig,
} from "@norish/config/zod/server-config";

import type { CreateAdminHooksOptions } from "./types";

export type AdminMutationsResult = {
  updateRegistration: (enabled: boolean) => Promise<{ success: boolean }>;
  updatePasswordAuth: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  updateLocaleConfig: (config: {
    defaultLocale: string;
    enabledLocales: string[];
  }) => Promise<{ success: boolean; error?: string }>;
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
  updateContentIndicators: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateUnits: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateRecurrenceConfig: (json: string) => Promise<{ success: boolean; error?: string }>;
  updatePrompts: (config: PromptsConfigInput) => Promise<{ success: boolean; error?: string }>;
  updateTimerKeywords: (
    config: TimerKeywordsInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateAIConfig: (config: AIConfig) => Promise<{ success: boolean; error?: string }>;
  updateVideoConfig: (config: VideoConfig) => Promise<{ success: boolean; error?: string }>;
  testAIEndpoint: (
    config: Pick<AIConfig, "provider" | "endpoint" | "apiKey">
  ) => Promise<{ success: boolean; error?: string }>;
  updateRecipePermissionPolicy: (
    policy: RecipePermissionPolicy
  ) => Promise<{ success: boolean; error?: string }>;
  updateSchedulerMonths: (months: number) => Promise<{ success: boolean; error?: string }>;
  restoreDefault: (key: ServerConfigKey) => Promise<{ success: boolean; error?: string }>;
  restartServer: () => Promise<{ success: boolean }>;
  fetchConfigSecret: (key: ServerConfigKey, field: string) => Promise<string | null>;
};

type CreateUseAdminMutationsOptions = CreateAdminHooksOptions & {
  useAdminConfigsQuery: () => { invalidate: () => void };
};

export function createUseAdminMutations({
  useTRPC,
  useAdminConfigsQuery,
}: CreateUseAdminMutationsOptions) {
  return function useAdminMutations(): AdminMutationsResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { invalidate } = useAdminConfigsQuery();

    const updateRegistrationMutation = useMutation(trpc.admin.updateRegistration.mutationOptions());
    const updatePasswordAuthMutation = useMutation(trpc.admin.updatePasswordAuth.mutationOptions());
    const updateLocaleConfigMutation = useMutation(trpc.admin.updateLocaleConfig.mutationOptions());
    const updateOIDCMutation = useMutation(trpc.admin.auth.updateOIDC.mutationOptions());
    const updateGitHubMutation = useMutation(trpc.admin.auth.updateGitHub.mutationOptions());
    const updateGoogleMutation = useMutation(trpc.admin.auth.updateGoogle.mutationOptions());
    const deleteProviderMutation = useMutation(trpc.admin.auth.deleteProvider.mutationOptions());
    const testProviderMutation = useMutation(trpc.admin.auth.testProvider.mutationOptions());
    const updateContentIndicatorsMutation = useMutation(
      trpc.admin.content.updateContentIndicators.mutationOptions()
    );
    const updateUnitsMutation = useMutation(trpc.admin.content.updateUnits.mutationOptions());
    const updateRecurrenceConfigMutation = useMutation(
      trpc.admin.content.updateRecurrenceConfig.mutationOptions()
    );
    const updatePromptsMutation = useMutation(trpc.admin.content.updatePrompts.mutationOptions());
    const updateTimerKeywordsMutation = useMutation(
      trpc.admin.content.updateTimerKeywords.mutationOptions()
    );
    const updateAIConfigMutation = useMutation(trpc.admin.updateAIConfig.mutationOptions());
    const updateVideoConfigMutation = useMutation(trpc.admin.updateVideoConfig.mutationOptions());
    const testAIEndpointMutation = useMutation(trpc.admin.testAIEndpoint.mutationOptions());
    const updatePermissionPolicyMutation = useMutation(
      trpc.admin.updateRecipePermissionPolicy.mutationOptions()
    );
    const updateSchedulerMonthsMutation = useMutation(
      trpc.admin.updateSchedulerMonths.mutationOptions()
    );
    const restoreDefaultMutation = useMutation(trpc.admin.restoreDefault.mutationOptions());
    const restartServerMutation = useMutation(trpc.admin.restartServer.mutationOptions());

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
      updateRegistration: async (enabled) => {
        return withInvalidate(updateRegistrationMutation.mutateAsync(enabled));
      },
      updatePasswordAuth: async (enabled) => {
        return withInvalidate(updatePasswordAuthMutation.mutateAsync(enabled));
      },
      updateLocaleConfig: async (config) => {
        return withInvalidate(updateLocaleConfigMutation.mutateAsync(config));
      },
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
        return testProviderMutation.mutateAsync({ type, config });
      },
      updateContentIndicators: async (json) => {
        const result = await withInvalidate(updateContentIndicatorsMutation.mutateAsync(json));

        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.timersEnabled.queryKey() });
        }

        return result;
      },
      updateUnits: async (json) => {
        return withInvalidate(updateUnitsMutation.mutateAsync(json));
      },
      updateRecurrenceConfig: async (json) => {
        return withInvalidate(updateRecurrenceConfigMutation.mutateAsync(json));
      },
      updatePrompts: async (config) => {
        return withInvalidate(updatePromptsMutation.mutateAsync(config));
      },
      updateTimerKeywords: async (config) => {
        const result = await withInvalidate(updateTimerKeywordsMutation.mutateAsync(config));

        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.timerKeywords.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.config.timersEnabled.queryKey() });
        }

        return result;
      },
      updateAIConfig: async (config) => {
        return withInvalidate(updateAIConfigMutation.mutateAsync(config));
      },
      updateVideoConfig: async (config) => {
        return withInvalidate(updateVideoConfigMutation.mutateAsync(config));
      },
      testAIEndpoint: async (config) => {
        return testAIEndpointMutation.mutateAsync(config);
      },
      updateRecipePermissionPolicy: async (policy) => {
        return withInvalidate(updatePermissionPolicyMutation.mutateAsync(policy));
      },
      updateSchedulerMonths: async (months) => {
        return withInvalidate(updateSchedulerMonthsMutation.mutateAsync(months));
      },
      restoreDefault: async (key) => {
        return withInvalidate(restoreDefaultMutation.mutateAsync(key));
      },
      restartServer: async () => {
        return restartServerMutation.mutateAsync();
      },
      fetchConfigSecret: async (key, field) => {
        const result = await queryClient.fetchQuery(
          trpc.admin.getSecretField.queryOptions({ key, field })
        );

        return result.value;
      },
    };
  };
}
