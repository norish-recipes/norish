import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  AIConfig,
  AuthProviderGitHubInput,
  AuthProviderGoogleInput,
  AuthProviderOIDCInput,
  DecisionConfig,
  ImageGenerationConfig,
  IngredientPermissionPolicy,
  PromptsConfig,
  RecipePermissionPolicy,
  ServerConfigKey,
  TimerKeywordsInput,
  VideoConfig,
} from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

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
  updateIngredientWords: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateRecurrenceConfig: (json: string) => Promise<{ success: boolean; error?: string }>;
  updatePrompts: (config: PromptsConfig) => Promise<{ success: boolean; error?: string }>;
  updateTimerKeywords: (
    config: TimerKeywordsInput
  ) => Promise<{ success: boolean; error?: string }>;
  updateAIConfig: (config: AIConfig) => Promise<{ success: boolean; error?: string }>;
  updateVideoConfig: (config: VideoConfig) => Promise<{ success: boolean; error?: string }>;
  updateImageGenerationConfig: (
    config: ImageGenerationConfig
  ) => Promise<{ success: boolean; error?: string }>;
  updateDecisionConfig: (config: DecisionConfig) => Promise<{ success: boolean; error?: string }>;
  testAIEndpoint: (
    config: Pick<AIConfig, "provider" | "endpoint" | "apiKey">
  ) => Promise<{ success: boolean; error?: string }>;
  testDecisionEndpoint: (
    config: Pick<DecisionConfig, "provider" | "apiKey" | "model" | "endpoint">
  ) => Promise<{ success: boolean; error?: string }>;
  updateRecipePermissionPolicy: (
    policy: RecipePermissionPolicy
  ) => Promise<{ success: boolean; error?: string }>;
  updateIngredientPermissionPolicy: (
    policy: IngredientPermissionPolicy
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
    "use memo";

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { invalidate } = useAdminConfigsQuery();

    const { mutateAsync: mutateUpdateRegistrationAsync } = useMutation(
      trpc.admin.updateRegistration.mutationOptions()
    );
    const { mutateAsync: mutateUpdatePasswordAuthAsync } = useMutation(
      trpc.admin.updatePasswordAuth.mutationOptions()
    );
    const { mutateAsync: mutateUpdateLocaleConfigAsync } = useMutation(
      trpc.admin.updateLocaleConfig.mutationOptions()
    );
    const { mutateAsync: mutateUpdateOIDCAsync } = useMutation(
      trpc.admin.auth.updateOIDC.mutationOptions()
    );
    const { mutateAsync: mutateUpdateGitHubAsync } = useMutation(
      trpc.admin.auth.updateGitHub.mutationOptions()
    );
    const { mutateAsync: mutateUpdateGoogleAsync } = useMutation(
      trpc.admin.auth.updateGoogle.mutationOptions()
    );
    const { mutateAsync: mutateDeleteProviderAsync } = useMutation(
      trpc.admin.auth.deleteProvider.mutationOptions()
    );
    const { mutateAsync: mutateTestProviderAsync } = useMutation(
      trpc.admin.auth.testProvider.mutationOptions()
    );
    const { mutateAsync: mutateUpdateContentIndicatorsAsync } = useMutation(
      trpc.admin.content.updateContentIndicators.mutationOptions()
    );
    const { mutateAsync: mutateUpdateUnitsAsync } = useMutation(
      trpc.admin.content.updateUnits.mutationOptions()
    );
    const { mutateAsync: mutateUpdateIngredientWordsAsync } = useMutation(
      trpc.admin.content.updateIngredientWords.mutationOptions()
    );
    const { mutateAsync: mutateUpdateRecurrenceConfigAsync } = useMutation(
      trpc.admin.content.updateRecurrenceConfig.mutationOptions()
    );
    const { mutateAsync: mutateUpdatePromptsAsync } = useMutation(
      trpc.admin.content.updatePrompts.mutationOptions()
    );
    const { mutateAsync: mutateUpdateTimerKeywordsAsync } = useMutation(
      trpc.admin.content.updateTimerKeywords.mutationOptions()
    );
    const { mutateAsync: mutateUpdateAIConfigAsync } = useMutation(
      trpc.admin.updateAIConfig.mutationOptions()
    );
    const { mutateAsync: mutateUpdateVideoConfigAsync } = useMutation(
      trpc.admin.updateVideoConfig.mutationOptions()
    );
    const updateImageGenerationConfigMutation = useMutation(
      trpc.admin.updateImageGenerationConfig.mutationOptions()
    );
    const { mutateAsync: mutateUpdateImageGenerationConfigAsync } =
      updateImageGenerationConfigMutation;
    const { mutateAsync: mutateUpdateDecisionConfigAsync } = useMutation(
      trpc.admin.updateDecisionConfig.mutationOptions()
    );
    const { mutateAsync: mutateTestAIEndpointAsync } = useMutation(
      trpc.admin.testAIEndpoint.mutationOptions()
    );
    const { mutateAsync: mutateTestDecisionEndpointAsync } = useMutation(
      trpc.admin.testDecisionEndpoint.mutationOptions()
    );
    const { mutateAsync: mutateUpdatePermissionPolicyAsync } = useMutation(
      trpc.admin.updateRecipePermissionPolicy.mutationOptions()
    );
    const { mutateAsync: mutateUpdateIngredientPolicyAsync } = useMutation(
      trpc.admin.updateIngredientPermissionPolicy.mutationOptions()
    );
    const { mutateAsync: mutateUpdateSchedulerMonthsAsync } = useMutation(
      trpc.admin.updateSchedulerMonths.mutationOptions()
    );
    const { mutateAsync: mutateRestoreDefaultAsync } = useMutation(
      trpc.admin.restoreDefault.mutationOptions()
    );
    const { mutateAsync: mutateRestartServerAsync } = useMutation(
      trpc.admin.restartServer.mutationOptions()
    );

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
        return withInvalidate(mutateUpdateRegistrationAsync(enabled));
      },
      updatePasswordAuth: async (enabled) => {
        return withInvalidate(mutateUpdatePasswordAuthAsync(enabled));
      },
      updateLocaleConfig: async (config) => {
        return withInvalidate(mutateUpdateLocaleConfigAsync(config));
      },
      updateAuthProviderOIDC: async (config) => {
        return withInvalidate(mutateUpdateOIDCAsync(config));
      },
      updateAuthProviderGitHub: async (config) => {
        return withInvalidate(mutateUpdateGitHubAsync(config));
      },
      updateAuthProviderGoogle: async (config) => {
        return withInvalidate(mutateUpdateGoogleAsync(config));
      },
      deleteAuthProvider: async (type) => {
        return withInvalidate(mutateDeleteProviderAsync(type));
      },
      testAuthProvider: async (type, config) => {
        return mutateTestProviderAsync({ type, config });
      },
      updateContentIndicators: async (json) => {
        const result = await withInvalidate(mutateUpdateContentIndicatorsAsync(json));

        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.timersEnabled.queryKey() });
        }

        return result;
      },
      updateUnits: async (json) => {
        const result = await withInvalidate(mutateUpdateUnitsAsync(json));

        // Every page that reads a name reads it by the units map too.
        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.units.queryKey() });
        }

        return result;
      },
      updateIngredientWords: async (json) => {
        const result = await withInvalidate(mutateUpdateIngredientWordsAsync(json));

        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.ingredientWords.queryKey() });
        }

        return result;
      },
      updateRecurrenceConfig: async (json) => {
        return withInvalidate(mutateUpdateRecurrenceConfigAsync(json));
      },
      updatePrompts: async (config) => {
        return withInvalidate(mutateUpdatePromptsAsync(config));
      },
      updateTimerKeywords: async (config) => {
        const result = await withInvalidate(mutateUpdateTimerKeywordsAsync(config));

        if (result.success) {
          queryClient.invalidateQueries({ queryKey: trpc.config.timerKeywords.queryKey() });
          queryClient.invalidateQueries({ queryKey: trpc.config.timersEnabled.queryKey() });
        }

        return result;
      },
      updateAIConfig: async (config) => {
        return withInvalidate(mutateUpdateAIConfigAsync(config));
      },
      updateVideoConfig: async (config) => {
        return withInvalidate(mutateUpdateVideoConfigAsync(config));
      },
      updateImageGenerationConfig: async (config) => {
        return withInvalidate(mutateUpdateImageGenerationConfigAsync(config));
      },
      updateDecisionConfig: async (config) => {
        return withInvalidate(mutateUpdateDecisionConfigAsync(config));
      },
      testAIEndpoint: async (config) => {
        return mutateTestAIEndpointAsync(config);
      },
      testDecisionEndpoint: async (config) => {
        return mutateTestDecisionEndpointAsync(config);
      },
      updateRecipePermissionPolicy: async (policy) => {
        return withInvalidate(mutateUpdatePermissionPolicyAsync(policy));
      },
      updateIngredientPermissionPolicy: async (policy) => {
        return withInvalidate(mutateUpdateIngredientPolicyAsync(policy));
      },
      updateSchedulerMonths: async (months) => {
        return withInvalidate(mutateUpdateSchedulerMonthsAsync(months));
      },
      restoreDefault: async (key) => {
        const result = await withInvalidate(mutateRestoreDefaultAsync(key));

        if (result.success && key === ServerConfigKeys.UNITS) {
          queryClient.invalidateQueries({ queryKey: trpc.config.units.queryKey() });
        }
        if (result.success && key === ServerConfigKeys.INGREDIENT_WORDS) {
          queryClient.invalidateQueries({ queryKey: trpc.config.ingredientWords.queryKey() });
        }

        return result;
      },
      restartServer: async () => {
        return mutateRestartServerAsync();
      },
      fetchConfigSecret: async (key, field) => {
        const result = await queryClient.query(
          trpc.admin.getSecretField.queryOptions({ key, field })
        );

        return result.value;
      },
    };
  };
}
