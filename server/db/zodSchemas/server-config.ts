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
} as const;

export type ServerConfigKey = (typeof ServerConfigKeys)[keyof typeof ServerConfigKeys];

// ============================================================================
// Auth Provider Schemas
// ============================================================================

// Base schema with isOverridden for storage
export const AuthProviderOIDCSchema = z.object({
  name: z.string().min(1, "Provider name is required"),
  issuer: z.url("Issuer must be a valid URL"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().optional(), // Optional on update, server preserves existing
  wellknown: z.url("Well-known URL must be valid").optional(),
  isOverridden: z.boolean().default(false), // True if admin edited, false means env-managed
});

export type AuthProviderOIDC = z.infer<typeof AuthProviderOIDCSchema>;

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
// Units Schema
// ============================================================================

export const UnitDefSchema = z.object({
  short: z.string(),
  plural: z.string(),
  alternates: z.array(z.string()),
});

export type UnitDef = z.infer<typeof UnitDefSchema>;

export const UnitsMapSchema = z.record(z.string(), UnitDefSchema);

export type UnitsMap = z.infer<typeof UnitsMapSchema>;

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

export const AIProviderSchema = z.enum(["openai", "ollama", "lm-studio", "generic-openai"]);

export type AIProvider = z.infer<typeof AIProviderSchema>;

export const AIConfigSchema = z.object({
  enabled: z.boolean(),
  provider: AIProviderSchema,
  endpoint: z.url("Endpoint must be a valid URL").optional(),
  model: z.string().min(1, "Model is required"),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive(),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;

// ============================================================================
// Video Configuration Schema (includes transcription settings)
// ============================================================================

export const TranscriptionProviderSchema = z.enum(["openai", "generic-openai", "disabled"]);

export type TranscriptionProvider = z.infer<typeof TranscriptionProviderSchema>;

export const VideoConfigSchema = z.object({
  enabled: z.boolean(),
  maxLengthSeconds: z.number().int().positive(),
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
      return UnitsMapSchema;
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
