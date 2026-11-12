import type {
  AIConfig,
  AuthProviderGitHub,
  AuthProviderGoogle,
  AuthProviderOIDC,
  ContentIndicatorsConfig,
  DecisionConfig,
  I18nLocaleConfig,
  ImageGenerationConfig,
  IngredientPermissionPolicy,
  IngredientWordsConfig,
  JobRetentionConfig,
  PromptsConfig,
  RecipePermissionPolicy,
  RecurrenceConfig,
  ServerConfigKeys,
  TimerKeywordsConfig,
  UnitsConfig,
  VideoConfig,
} from "@norish/config/zod/server-config";

/** What `admin.getAllConfigs` holds under each key the admin page draws, secrets masked. */
export type AdminConfigs = {
  [ServerConfigKeys.REGISTRATION_ENABLED]: boolean;
  [ServerConfigKeys.PASSWORD_AUTH_ENABLED]: boolean;
  [ServerConfigKeys.LOCALE_CONFIG]: I18nLocaleConfig;
  [ServerConfigKeys.AUTH_PROVIDER_OIDC]: AuthProviderOIDC;
  [ServerConfigKeys.AUTH_PROVIDER_GITHUB]: AuthProviderGitHub;
  [ServerConfigKeys.AUTH_PROVIDER_GOOGLE]: AuthProviderGoogle;
  [ServerConfigKeys.CONTENT_INDICATORS]: ContentIndicatorsConfig;
  [ServerConfigKeys.UNITS]: UnitsConfig;
  [ServerConfigKeys.INGREDIENT_WORDS]: IngredientWordsConfig;
  [ServerConfigKeys.RECURRENCE_CONFIG]: RecurrenceConfig;
  [ServerConfigKeys.TIMER_KEYWORDS]: TimerKeywordsConfig;
  [ServerConfigKeys.AI_CONFIG]: AIConfig;
  [ServerConfigKeys.VIDEO_CONFIG]: VideoConfig;
  [ServerConfigKeys.IMAGE_GENERATION_CONFIG]: ImageGenerationConfig;
  [ServerConfigKeys.DECISION_CONFIG]: DecisionConfig;
  [ServerConfigKeys.PROMPTS]: PromptsConfig;
  [ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS]: number;
  [ServerConfigKeys.JOB_RETENTION]: JobRetentionConfig;
  [ServerConfigKeys.RECIPE_PERMISSION_POLICY]: RecipePermissionPolicy;
  [ServerConfigKeys.INGREDIENT_PERMISSION_POLICY]: IngredientPermissionPolicy;
};

export type AdminConfigKey = keyof AdminConfigs;

/** An OAuth sign-in provider. */
export type AuthProvider = "oidc" | "github" | "google";
