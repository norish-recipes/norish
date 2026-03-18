import { z } from "zod";

// ============================================================================
// Server Configuration Keys
// ============================================================================

export const ServerConfigKeys = {
  REGISTRATION_ENABLED: "registration_enabled",
  PASSWORD_AUTH_ENABLED: "password_auth_enabled",
  AUTH_PROVIDER_OIDC: "auth_provider_oidc",
  AUTH_PROVIDER_GITHUB: "auth_provider_github",
  AUTH_PROVIDER_GOOGLE: "auth_provider_google",
  UNITS: "units",
  CONTENT_INDICATORS: "content_indicators",
  RECURRENCE_CONFIG: "recurrence_config",
  AI_CONFIG: "ai_config",
  VIDEO_CONFIG: "video_config",
  SCHEDULER_CLEANUP_MONTHS: "scheduler_cleanup_months",
  RECIPE_PERMISSION_POLICY: "recipe_permission_policy",
  PROMPTS: "prompts",
  LOCALE_CONFIG: "locale_config",
  TIMER_KEYWORDS: "timer_keywords",
} as const;

export type ServerConfigKey = (typeof ServerConfigKeys)[keyof typeof ServerConfigKeys];

// ============================================================================
// Auth Provider Schemas
// ============================================================================

// ============================================================================
// OIDC Claim Mapping Schema
// ============================================================================

export const OIDCClaimConfigSchema = z.object({
  // Whether claim mapping is enabled (disabled by default for security)
  enabled: z.boolean().default(false),
  // Additional scopes to request (e.g., ["groups"] for Keycloak)
  scopes: z.array(z.string()).default([]),
  // Claim name that contains groups/roles
  groupsClaim: z.string().default("groups"),
  // Group name that grants admin role (case-insensitive)
  adminGroup: z.string().default("norish_admin"),
  // Prefix for household groups
  householdPrefix: z.string().default("norish_household_"),
});

export type OIDCClaimConfig = z.infer<typeof OIDCClaimConfigSchema>;

// Base schema with isOverridden for storage
export const AuthProviderOIDCSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  issuer: z.url("Issuer must be a valid URL"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().optional(), // Optional on update, server preserves existing
  wellknown: z.url("Well-known URL must be valid").optional(),
  isOverridden: z.boolean().default(false), // True if admin edited, false means env-managed
  claimConfig: OIDCClaimConfigSchema.optional(), // Claim-based role and household assignment
});

export type AuthProviderOIDC = z.infer<typeof AuthProviderOIDCSchema>;

export const OIDCClaimConfigInputSchema = OIDCClaimConfigSchema;
export type OIDCClaimConfigInput = z.infer<typeof OIDCClaimConfigInputSchema>;

export const AuthProviderOIDCInputSchema = AuthProviderOIDCSchema.omit({ isOverridden: true });
export type AuthProviderOIDCInput = z.infer<typeof AuthProviderOIDCInputSchema>;

export const AuthProviderGitHubSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().optional(), // Optional on update, server preserves existing
  isOverridden: z.boolean().default(false), // True if admin edited, false means env-managed
});

export type AuthProviderGitHub = z.infer<typeof AuthProviderGitHubSchema>;

export const AuthProviderGitHubInputSchema = AuthProviderGitHubSchema.omit({ isOverridden: true });
export type AuthProviderGitHubInput = z.infer<typeof AuthProviderGitHubInputSchema>;

export const AuthProviderGoogleSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().optional(), // Optional on update, server preserves existing
  isOverridden: z.boolean().default(false), // True if admin edited, false means env-managed
});

export type AuthProviderGoogle = z.infer<typeof AuthProviderGoogleSchema>;

export const AuthProviderGoogleInputSchema = AuthProviderGoogleSchema.omit({ isOverridden: true });
export type AuthProviderGoogleInput = z.infer<typeof AuthProviderGoogleInputSchema>;

// ============================================================================
// Content Indicators Schema
// ============================================================================

export const ContentIndicatorsSchema = z.object({
  schemaIndicators: z.array(z.string()),
  contentIndicators: z.array(z.string()),
});

export type ContentIndicatorsConfig = z.infer<typeof ContentIndicatorsSchema>;

// ============================================================================
// Timer Keywords Schema
// ============================================================================

export const TimerKeywordsSchema = z.object({
  enabled: z.boolean().default(true),
  hours: z.array(z.string()).default([]),
  minutes: z.array(z.string()).default([]),
  seconds: z.array(z.string()).default([]),
  isOverridden: z.boolean().default(false),
});

export type TimerKeywordsConfig = z.infer<typeof TimerKeywordsSchema>;

export const TimerKeywordsInputSchema = TimerKeywordsSchema.omit({ isOverridden: true });
export type TimerKeywordsInput = z.infer<typeof TimerKeywordsInputSchema>;

// ============================================================================
// Prompts Schema
// ============================================================================

export const PromptsConfigSchema = z.object({
  recipeExtraction: z.string(),
  unitConversion: z.string(),
  nutritionEstimation: z.string(),
  autoTagging: z.string(),
  isOverridden: z.boolean().default(false),
});

export type PromptsConfig = z.infer<typeof PromptsConfigSchema>;

export const PromptsConfigInputSchema = PromptsConfigSchema.omit({ isOverridden: true });
export type PromptsConfigInput = z.infer<typeof PromptsConfigInputSchema>;

// ============================================================================
// i18n Locale Configuration Schema
// ============================================================================

export const I18nLocaleEntrySchema = z.object({
  name: z.string(),
  enabled: z.boolean(),
});

export type I18nLocaleEntry = z.infer<typeof I18nLocaleEntrySchema>;

export const I18nLocaleConfigSchema = z.object({
  defaultLocale: z.string(),
  locales: z.record(z.string(), I18nLocaleEntrySchema),
});

export type I18nLocaleConfig = z.infer<typeof I18nLocaleConfigSchema>;

// ============================================================================
// Units Schema
// ============================================================================

// Locale-aware units configuration
export const UnitsMapSchema = z.record(
  z.string(),
  z.object({
    short: z.array(z.object({ locale: z.string().min(1), name: z.string().min(1) })).min(1),
    plural: z.array(z.object({ locale: z.string().min(1), name: z.string().min(1) })).min(1),
    alternates: z.array(z.string()),
  })
);

export type UnitsMap = z.infer<typeof UnitsMapSchema>;

// Units configuration with isOverridden flag (for database storage)
export const UnitsConfigSchema = z.object({
  units: UnitsMapSchema,
  isOverridden: z.boolean().default(false),
});

export type UnitsConfig = z.infer<typeof UnitsConfigSchema>;

// Flat units map (for parse-ingredient library compatibility)
export type FlatUnitsMap = Record<
  string,
  {
    short: string;
    plural: string;
    alternates: string[];
  }
>;

// ============================================================================
// Recurrence Config Schema
// ============================================================================

export const IntervalHintSchema = z.object({
  phrases: z.array(z.string()),
  interval: z.number().int().positive(),
  rule: z.string(),
});

export const LocaleConfigSchema = z.object({
  everyWords: z.array(z.string()),
  otherWords: z.array(z.string()),
  onWords: z.array(z.string()),
  numberWords: z.record(z.string(), z.number().int().positive()),
  unitWords: z.record(z.string(), z.array(z.string())),
  weekdayWords: z.record(z.string(), z.number().int().min(0).max(6)),
  intervalHints: z.array(IntervalHintSchema),
});

export const RecurrenceConfigSchema = z.object({
  locales: z.record(z.string(), LocaleConfigSchema),
});

export type RecurrenceConfig = z.infer<typeof RecurrenceConfigSchema>;

// ============================================================================
// AI Configuration Schema
// ============================================================================

export const AIProviderSchema = z.enum([
  "openai",
  "ollama",
  "lm-studio",
  "generic-openai",
  "perplexity",
  "azure",
  "mistral",
  "anthropic",
  "deepseek",
  "google",
  "groq",
]);

export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AutoTaggingModeSchema = z.enum([
  "disabled",
  "predefined",
  "predefined_db",
  "freeform",
]);

export type AutoTaggingMode = z.infer<typeof AutoTaggingModeSchema>;

export const AIConfigSchema = z.object({
  enabled: z.boolean(),
  provider: AIProviderSchema,
  endpoint: z.url("Endpoint must be a valid URL").optional(),
  model: z.string().min(1, "Model is required"),
  visionModel: z.string().optional(), // Optional: separate model for vision/image tasks
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
  autoTagAllergies: z.boolean().default(true),
  alwaysUseAI: z.boolean().default(false),
  autoTaggingMode: AutoTaggingModeSchema.default("disabled"),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

// ============================================================================
// Video Configuration Schema (includes transcription settings)
// ============================================================================

export const TranscriptionProviderSchema = z.enum([
  "openai",
  "groq",
  "azure",
  "generic-openai",
  "ollama",
  "disabled",
]);

export type TranscriptionProvider = z.infer<typeof TranscriptionProviderSchema>;

/** All enabled (non-disabled) transcription providers. */
export const TRANSCRIPTION_PROVIDERS_ENABLED = [
  "openai",
  "groq",
  "azure",
  "generic-openai",
  "ollama",
] as const satisfies readonly TranscriptionProvider[];

/** Cloud providers that require an API key. */
export const TRANSCRIPTION_PROVIDERS_CLOUD = [
  "openai",
  "groq",
  "azure",
] as const satisfies readonly TranscriptionProvider[];

/** Providers that require an endpoint URL. */
export const TRANSCRIPTION_PROVIDERS_NEED_ENDPOINT = [
  "generic-openai",
  "azure",
  "ollama",
] as const satisfies readonly TranscriptionProvider[];

/** Providers that support dynamic model listing. */
export const TRANSCRIPTION_PROVIDERS_WITH_MODEL_LISTING = [
  "openai",
  "groq",
  "generic-openai",
  "ollama",
] as const satisfies readonly TranscriptionProvider[];

/** Check if provider is a cloud provider (requires API key). */
export function isCloudTranscriptionProvider(provider: TranscriptionProvider): boolean {
  return (TRANSCRIPTION_PROVIDERS_CLOUD as readonly string[]).includes(provider);
}

/** Check if provider needs an endpoint URL. */
export function transcriptionProviderNeedsEndpoint(provider: TranscriptionProvider): boolean {
  return (TRANSCRIPTION_PROVIDERS_NEED_ENDPOINT as readonly string[]).includes(provider);
}

/** Check if provider supports dynamic model listing. */
export function transcriptionProviderSupportsModelListing(
  provider: TranscriptionProvider
): boolean {
  return (TRANSCRIPTION_PROVIDERS_WITH_MODEL_LISTING as readonly string[]).includes(provider);
}

export const VideoConfigSchema = z.object({
  enabled: z.boolean(),
  maxLengthSeconds: z.number().int().positive(),
  maxVideoFileSize: z.number().int().positive(), // Max video file size in bytes
  ytDlpVersion: z.string().min(1),
  // Transcription settings (required for video processing)
  transcriptionProvider: TranscriptionProviderSchema,
  transcriptionEndpoint: z.url("Endpoint must be a valid URL").optional(),
  transcriptionApiKey: z.string().optional(),
  transcriptionModel: z.string().min(1, "Model is required"),
});

export type VideoConfig = z.infer<typeof VideoConfigSchema>;

// ============================================================================
// Scheduler Configuration Schema
// ============================================================================

export const SchedulerCleanupMonthsSchema = z.number().int().min(1).max(24);

// ============================================================================
// Recipe Permission Policy Schema
// ============================================================================

export const PermissionLevelSchema = z.enum(["everyone", "household", "owner"]);

export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;

export const RecipePermissionPolicySchema = z.object({
  view: PermissionLevelSchema.default("everyone"),
  edit: PermissionLevelSchema.default("household"),
  delete: PermissionLevelSchema.default("household"),
});

export type RecipePermissionPolicy = z.infer<typeof RecipePermissionPolicySchema>;

export const DEFAULT_RECIPE_PERMISSION_POLICY: RecipePermissionPolicy = {
  view: "everyone",
  edit: "household",
  delete: "household",
};

// ============================================================================
// Server Config Entry Schema (for database rows)
// ============================================================================

export const ServerConfigEntrySchema = z.object({
  id: z.uuid(),
  key: z.string(),
  value: z.any().nullable(),
  valueEnc: z.string().nullable(),
  isSensitive: z.boolean(),
  updatedBy: z.uuid().nullable(),
  updatedAt: z.date(),
  createdAt: z.date(),
});

export type ServerConfigEntry = z.infer<typeof ServerConfigEntrySchema>;

// ============================================================================
// Config Key Metadata (for UI display)
// ============================================================================

export const ServerConfigMetadataSchema = z.object({
  key: z.string(),
  updatedAt: z.date(),
  updatedBy: z.uuid().nullable(),
  hasSensitiveData: z.boolean(),
});

export type ServerConfigMetadata = z.infer<typeof ServerConfigMetadataSchema>;

// ============================================================================
// User Server Role Schema
// ============================================================================

export const UserServerRoleSchema = z.object({
  isOwner: z.boolean(),
  isAdmin: z.boolean(),
});

export type UserServerRole = z.infer<typeof UserServerRoleSchema>;

// ============================================================================
// Validation helpers
// ============================================================================

/**
 * Get the appropriate Zod schema for a given config key
 */
export function getSchemaForConfigKey(key: ServerConfigKey): z.ZodType {
  switch (key) {
    case ServerConfigKeys.REGISTRATION_ENABLED:
      return z.boolean();
    case ServerConfigKeys.AUTH_PROVIDER_OIDC:
      return AuthProviderOIDCSchema;
    case ServerConfigKeys.AUTH_PROVIDER_GITHUB:
      return AuthProviderGitHubSchema;
    case ServerConfigKeys.AUTH_PROVIDER_GOOGLE:
      return AuthProviderGoogleSchema;
    case ServerConfigKeys.UNITS:
      return UnitsConfigSchema;
    case ServerConfigKeys.CONTENT_INDICATORS:
      return ContentIndicatorsSchema;
    case ServerConfigKeys.RECURRENCE_CONFIG:
      return RecurrenceConfigSchema;
    case ServerConfigKeys.AI_CONFIG:
      return AIConfigSchema;
    case ServerConfigKeys.VIDEO_CONFIG:
      return VideoConfigSchema;
    case ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS:
      return SchedulerCleanupMonthsSchema;
    case ServerConfigKeys.RECIPE_PERMISSION_POLICY:
      return RecipePermissionPolicySchema;
    case ServerConfigKeys.PROMPTS:
      return PromptsConfigSchema;
    case ServerConfigKeys.LOCALE_CONFIG:
      return I18nLocaleConfigSchema;
    case ServerConfigKeys.TIMER_KEYWORDS:
      return TimerKeywordsSchema;
    default:
      return z.any();
  }
}

/**
 * Validate config value against its schema
 */
export function validateConfigValue(
  key: ServerConfigKey,
  value: unknown
): { success: true; data: unknown } | { success: false; error: z.ZodError } {
  const schema = getSchemaForConfigKey(key);
  const result = schema.safeParse(value);

  return result;
}

/**
 * Keys that contain sensitive data requiring encryption
 */
export const SENSITIVE_CONFIG_KEYS: ServerConfigKey[] = [
  ServerConfigKeys.AUTH_PROVIDER_OIDC,
  ServerConfigKeys.AUTH_PROVIDER_GITHUB,
  ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
  ServerConfigKeys.AI_CONFIG,
  ServerConfigKeys.VIDEO_CONFIG,
];

/**
 * Keys that require server restart after change
 */
export const RESTART_REQUIRED_KEYS: ServerConfigKey[] = [
  ServerConfigKeys.AUTH_PROVIDER_OIDC,
  ServerConfigKeys.AUTH_PROVIDER_GITHUB,
  ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
];
