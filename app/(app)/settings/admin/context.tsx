"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";

import { useAdminConfigsQuery, useAdminMutations } from "@/hooks/admin";
import {
  ServerConfigKeys,
  type ContentIndicatorsConfig,
  type UnitsMap,
  type RecurrenceConfig,
  type AIConfig,
  type VideoConfig,
  type AuthProviderOIDC,
  type AuthProviderOIDCInput,
  type AuthProviderGitHub,
  type AuthProviderGitHubInput,
  type AuthProviderGoogle,
  type AuthProviderGoogleInput,
  type RecipePermissionPolicy,
  type ServerConfigKey,
} from "@/server/db/zodSchemas/server-config";

// ============================================================================
// Context Type
// ============================================================================

interface AdminSettingsContextValue {
  // Data
  registrationEnabled: boolean | undefined;
  passwordAuthEnabled: boolean | undefined;
  authProviderOIDC: AuthProviderOIDC | undefined;
  authProviderGitHub: AuthProviderGitHub | undefined;
  authProviderGoogle: AuthProviderGoogle | undefined;
  contentIndicators: ContentIndicatorsConfig | undefined;
  units: UnitsMap | undefined;
  recurrenceConfig: RecurrenceConfig | undefined;
  aiConfig: AIConfig | undefined;
  videoConfig: VideoConfig | undefined;
  schedulerCleanupMonths: number | undefined;
  recipePermissionPolicy: RecipePermissionPolicy | undefined;

  // Loading states
  isLoading: boolean;

  // Actions
  updateRegistration: (enabled: boolean) => Promise<void>;
  updatePasswordAuth: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
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
  updateContentIndicators: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateUnits: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateRecurrenceConfig: (json: string) => Promise<{ success: boolean; error?: string }>;
  updateAIConfig: (config: AIConfig) => Promise<{ success: boolean; error?: string }>;
  updateVideoConfig: (config: VideoConfig) => Promise<{ success: boolean; error?: string }>;
  updateSchedulerMonths: (months: number) => Promise<{ success: boolean; error?: string }>;
  updateRecipePermissionPolicy: (
    policy: RecipePermissionPolicy
  ) => Promise<{ success: boolean; error?: string }>;
  restoreDefaultConfig: (key: string) => Promise<{ success: boolean; error?: string }>;
  testAuthProvider: (
    type: "oidc" | "github" | "google",
    config: Record<string, unknown>
  ) => Promise<{ success: boolean; error?: string }>;
  testAIEndpoint: (
    config: Pick<AIConfig, "provider" | "endpoint" | "apiKey">
  ) => Promise<{ success: boolean; error?: string }>;
  restartServer: () => Promise<void>;

  // Secret fetching
  fetchConfigSecret: (key: ServerConfigKey, field: string) => Promise<string | null>;

  // Refresh
  refresh: () => void;
}

const AdminSettingsContext = createContext<AdminSettingsContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function AdminSettingsProvider({ children }: { children: ReactNode }) {
  // Use tRPC hooks
  const { configs, isLoading, invalidate } = useAdminConfigsQuery();
  const mutations = useAdminMutations();

  // Extract typed config values
  const registrationEnabled = configs[ServerConfigKeys.REGISTRATION_ENABLED] as boolean | undefined;
  const passwordAuthEnabled = configs[ServerConfigKeys.PASSWORD_AUTH_ENABLED] as
    | boolean
    | undefined;
  const authProviderOIDC = configs[ServerConfigKeys.AUTH_PROVIDER_OIDC] as
    | AuthProviderOIDC
    | undefined;
  const authProviderGitHub = configs[ServerConfigKeys.AUTH_PROVIDER_GITHUB] as
    | AuthProviderGitHub
    | undefined;
  const authProviderGoogle = configs[ServerConfigKeys.AUTH_PROVIDER_GOOGLE] as
    | AuthProviderGoogle
    | undefined;
  const contentIndicators = configs[ServerConfigKeys.CONTENT_INDICATORS] as
    | ContentIndicatorsConfig
    | undefined;
  const units = configs[ServerConfigKeys.UNITS] as UnitsMap | undefined;
  const recurrenceConfig = configs[ServerConfigKeys.RECURRENCE_CONFIG] as
    | RecurrenceConfig
    | undefined;
  const aiConfig = configs[ServerConfigKeys.AI_CONFIG] as AIConfig | undefined;
  const videoConfig = configs[ServerConfigKeys.VIDEO_CONFIG] as VideoConfig | undefined;
  const schedulerCleanupMonths = configs[ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS] as
    | number
    | undefined;
  const recipePermissionPolicy = configs[ServerConfigKeys.RECIPE_PERMISSION_POLICY] as
    | RecipePermissionPolicy
    | undefined;

  // Actions - wrap mutations
  const updateRegistration = useCallback(
    async (enabled: boolean) => {
      await mutations.updateRegistration(enabled);
    },
    [mutations]
  );

  const updatePasswordAuth = useCallback(
    async (enabled: boolean) => {
      return mutations.updatePasswordAuth(enabled);
    },
    [mutations]
  );

  const updateAuthOIDC = useCallback(
    async (config: AuthProviderOIDCInput) => {
      return mutations.updateAuthProviderOIDC(config);
    },
    [mutations]
  );

  const updateAuthGitHub = useCallback(
    async (config: AuthProviderGitHubInput) => {
      return mutations.updateAuthProviderGitHub(config);
    },
    [mutations]
  );

  const updateAuthGoogle = useCallback(
    async (config: AuthProviderGoogleInput) => {
      return mutations.updateAuthProviderGoogle(config);
    },
    [mutations]
  );

  const deleteProvider = useCallback(
    async (type: "oidc" | "github" | "google") => {
      return mutations.deleteAuthProvider(type);
    },
    [mutations]
  );

  const updateContent = useCallback(
    async (json: string) => {
      return mutations.updateContentIndicators(json);
    },
    [mutations]
  );

  const updateUnitsConfig = useCallback(
    async (json: string) => {
      return mutations.updateUnits(json);
    },
    [mutations]
  );

  const updateRecurrence = useCallback(
    async (json: string) => {
      return mutations.updateRecurrenceConfig(json);
    },
    [mutations]
  );

  const updateAI = useCallback(
    async (config: AIConfig) => {
      return mutations.updateAIConfig(config);
    },
    [mutations]
  );

  const updateVideo = useCallback(
    async (config: VideoConfig) => {
      return mutations.updateVideoConfig(config);
    },
    [mutations]
  );

  const updateScheduler = useCallback(
    async (months: number) => {
      return mutations.updateSchedulerMonths(months);
    },
    [mutations]
  );

  const updatePermissionPolicy = useCallback(
    async (policy: RecipePermissionPolicy) => {
      return mutations.updateRecipePermissionPolicy(policy);
    },
    [mutations]
  );

  const restoreDefault = useCallback(
    async (key: string) => {
      return mutations.restoreDefault(key as ServerConfigKey);
    },
    [mutations]
  );

  const testAuth = useCallback(
    async (type: "oidc" | "github" | "google", config: Record<string, unknown>) => {
      return mutations.testAuthProvider(type, config);
    },
    [mutations]
  );

  const testAI = useCallback(
    async (config: Pick<AIConfig, "provider" | "endpoint" | "apiKey">) => {
      return mutations.testAIEndpoint(config);
    },
    [mutations]
  );

  const restart = useCallback(async () => {
    await mutations.restartServer();
  }, [mutations]);

  const fetchSecret = useCallback(
    async (key: ServerConfigKey, field: string) => {
      return mutations.fetchConfigSecret(key, field);
    },
    [mutations]
  );

  const refresh = useCallback(() => {
    invalidate();
  }, [invalidate]);

  const value: AdminSettingsContextValue = {
    registrationEnabled,
    passwordAuthEnabled,
    authProviderOIDC,
    authProviderGitHub,
    authProviderGoogle,
    contentIndicators,
    units,
    recurrenceConfig,
    aiConfig,
    videoConfig,
    schedulerCleanupMonths,
    recipePermissionPolicy,
    isLoading,
    updateRegistration,
    updatePasswordAuth,
    updateAuthProviderOIDC: updateAuthOIDC,
    updateAuthProviderGitHub: updateAuthGitHub,
    updateAuthProviderGoogle: updateAuthGoogle,
    deleteAuthProvider: deleteProvider,
    updateContentIndicators: updateContent,
    updateUnits: updateUnitsConfig,
    updateRecurrenceConfig: updateRecurrence,
    updateAIConfig: updateAI,
    updateVideoConfig: updateVideo,
    updateSchedulerMonths: updateScheduler,
    updateRecipePermissionPolicy: updatePermissionPolicy,
    restoreDefaultConfig: restoreDefault,
    testAuthProvider: testAuth,
    testAIEndpoint: testAI,
    restartServer: restart,
    fetchConfigSecret: fetchSecret,
    refresh,
  };

  return <AdminSettingsContext.Provider value={value}>{children}</AdminSettingsContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAdminSettingsContext() {
  const context = useContext(AdminSettingsContext);

  if (!context)
    throw new Error("useAdminSettingsContext must be used within AdminSettingsProvider");

  return context;
}
