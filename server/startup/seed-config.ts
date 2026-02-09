import type { I18nLocaleConfig } from "@/server/db/zodSchemas/server-config";

import { setConfig, configExists, getConfig, deleteConfig } from "../db/repositories/server-config";
import {
  ServerConfigKeys,
  type ServerConfigKey,
  type AuthProviderGitHub,
  type AuthProviderGoogle,
  type AuthProviderOIDC,
  type PromptsConfig,
  type TimerKeywordsConfig,
  DEFAULT_RECIPE_PERMISSION_POLICY,
} from "../db/zodSchemas/server-config";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { DEFAULT_LOCALE_CONFIG, buildLocaleConfigFromEnv } from "@/config/server-config-loader";
import { setAuthProviderCache } from "@/server/auth/provider-cache";
import { serverLogger } from "@/server/logger";
import defaultUnits from "@/config/units.default.json";
import defaultContentIndicators from "@/config/content-indicators.default.json";
import defaultRecurrenceConfig from "@/config/recurrence-config.default.json";
import defaultTimerKeywords from "@/config/timer-keywords.default.json";
import { loadDefaultPrompts } from "@/server/ai/prompts/loader";

/**
 * Configuration definition for seeding
 * Each key maps to its default value, sensitivity flag, and description
 */
interface ConfigDefinition {
  key: ServerConfigKey;
  getDefaultValue: () => unknown;
  sensitive: boolean;
  description: string;
}

/**
 * Check if any OAuth provider is configured via environment variables
 */
function hasOAuthEnvConfigured(): boolean {
  return !!(
    (SERVER_CONFIG.OIDC_CLIENT_ID &&
      SERVER_CONFIG.OIDC_CLIENT_SECRET &&
      SERVER_CONFIG.OIDC_ISSUER) ||
    (SERVER_CONFIG.GITHUB_CLIENT_ID && SERVER_CONFIG.GITHUB_CLIENT_SECRET) ||
    (SERVER_CONFIG.GOOGLE_CLIENT_ID && SERVER_CONFIG.GOOGLE_CLIENT_SECRET)
  );
}

/**
 * All required server config keys with their default values
 * When adding a new config key, add it here and it will be automatically seeded
 */
const REQUIRED_CONFIGS: ConfigDefinition[] = [
  {
    key: ServerConfigKeys.REGISTRATION_ENABLED,
    getDefaultValue: () => true,
    sensitive: false,
    description: "Registration enabled",
  },
  {
    key: ServerConfigKeys.PASSWORD_AUTH_ENABLED,
    // Enable password auth by default if no OAuth providers are configured via env
    getDefaultValue: () => !hasOAuthEnvConfigured(),
    sensitive: false,
    description: "Password authentication enabled",
  },
  {
    key: ServerConfigKeys.UNITS,
    getDefaultValue: () => defaultUnits,
    sensitive: false,
    description: `Units (${Object.keys(defaultUnits).length} definitions)`,
  },
  {
    key: ServerConfigKeys.CONTENT_INDICATORS,
    getDefaultValue: () => defaultContentIndicators,
    sensitive: false,
    description: "Content indicators",
  },
  {
    key: ServerConfigKeys.RECURRENCE_CONFIG,
    getDefaultValue: () => defaultRecurrenceConfig,
    sensitive: false,
    description: `Recurrence config (${Object.keys(defaultRecurrenceConfig.locales).length} locales)`,
  },
  {
    key: ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS,
    getDefaultValue: () => SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS,
    sensitive: false,
    description: `Scheduler cleanup: ${SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS} months`,
  },
  {
    key: ServerConfigKeys.AI_CONFIG,
    getDefaultValue: () => ({
      enabled: SERVER_CONFIG.AI_ENABLED,
      provider: SERVER_CONFIG.AI_PROVIDER,
      endpoint: SERVER_CONFIG.AI_ENDPOINT || undefined,
      model: SERVER_CONFIG.AI_MODEL,
      apiKey: SERVER_CONFIG.AI_API_KEY || undefined,
      temperature: SERVER_CONFIG.AI_TEMPERATURE,
      maxTokens: SERVER_CONFIG.AI_MAX_TOKENS,
    }),
    sensitive: true, // sensitive due to API key
    description: `AI config (${SERVER_CONFIG.AI_ENABLED ? "enabled" : "disabled"})`,
  },
  {
    key: ServerConfigKeys.VIDEO_CONFIG,
    getDefaultValue: () => ({
      enabled: SERVER_CONFIG.VIDEO_PARSING_ENABLED,
      maxLengthSeconds: SERVER_CONFIG.VIDEO_MAX_LENGTH_SECONDS,
      maxVideoFileSize: SERVER_CONFIG.MAX_VIDEO_FILE_SIZE,
      ytDlpVersion: SERVER_CONFIG.YT_DLP_VERSION,
      transcriptionProvider: SERVER_CONFIG.TRANSCRIPTION_PROVIDER,
      transcriptionEndpoint: SERVER_CONFIG.TRANSCRIPTION_ENDPOINT || undefined,
      transcriptionApiKey: SERVER_CONFIG.TRANSCRIPTION_API_KEY || undefined,
      transcriptionModel: SERVER_CONFIG.TRANSCRIPTION_MODEL,
    }),
    sensitive: true, // sensitive due to transcription API key
    description: `Video config (${SERVER_CONFIG.VIDEO_PARSING_ENABLED ? "enabled" : "disabled"})`,
  },
  {
    key: ServerConfigKeys.RECIPE_PERMISSION_POLICY,
    getDefaultValue: () => DEFAULT_RECIPE_PERMISSION_POLICY,
    sensitive: false,
    description: "Recipe permission policy (default: household)",
  },
  {
    key: ServerConfigKeys.PROMPTS,
    getDefaultValue: () => ({ ...loadDefaultPrompts(), isOverridden: false }),
    sensitive: false,
    description: "AI prompts for recipe extraction and unit conversion",
  },
  {
    key: ServerConfigKeys.LOCALE_CONFIG,
    getDefaultValue: () => buildLocaleConfigFromEnv(),
    sensitive: false,
    description: `Locale config (${Object.keys(DEFAULT_LOCALE_CONFIG.locales).length} locales)`,
  },
  {
    key: ServerConfigKeys.TIMER_KEYWORDS,
    getDefaultValue: () => ({ ...defaultTimerKeywords, isOverridden: false }),
    sensitive: false,
    description: "Timer detection keywords for multilingual support",
  },
];

/**
 * Seed the server_config table with default values
 *
 * This runs after migrations and:
 * 1. Checks each required config key
 * 2. Seeds missing keys with defaults
 * 3. Imports any env-configured auth providers if none exist in DB
 */
export async function seedServerConfig(): Promise<void> {
  serverLogger.info("Checking server configuration...");

  // Always validate and seed missing configs
  const seededCount = await seedMissingConfigs();

  await importEnvAuthProvidersIfMissing();
  await syncPrompts();
  await syncLocales();
  await syncTimerKeywords();

  if (seededCount === 0) {
    serverLogger.info("All server configuration keys present");
  } else {
    serverLogger.info({ count: seededCount }, "Seeded configuration keys");
  }

  // Load auth providers into cache for BetterAuth initialization
  await loadAuthProvidersIntoCache();

  serverLogger.info("Server configuration check complete");
}

/**
 * Load auth providers from database into the in-memory cache
 * This must run before the auth module is imported so BetterAuth can use DB-configured providers
 */
async function loadAuthProvidersIntoCache(): Promise<void> {
  const github = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);
  const google = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);
  const oidc = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);
  const passwordEnabled = await getConfig<boolean>(ServerConfigKeys.PASSWORD_AUTH_ENABLED);

  setAuthProviderCache({ github, google, oidc, passwordEnabled: passwordEnabled ?? false });

  const configured = [
    github && "GitHub",
    google && "Google",
    oidc && `OIDC (${oidc.name})`,
    passwordEnabled && "Password",
  ].filter(Boolean);

  if (configured.length > 0) {
    serverLogger.info({ providers: configured }, "Auth providers loaded");
  } else {
    serverLogger.warn("No auth providers configured - users will not be able to log in");
  }
}

/**
 * Validate all required configs and seed any missing ones
 * This ensures new config keys added in updates are automatically seeded
 * @returns The number of configs that were seeded
 */
async function seedMissingConfigs(): Promise<number> {
  let seededCount = 0;

  for (const config of REQUIRED_CONFIGS) {
    const exists = await configExists(config.key);

    if (!exists) {
      await setConfig(config.key, config.getDefaultValue(), null, config.sensitive);
      serverLogger.info({ key: config.key, description: config.description }, "Seeded config");
      seededCount++;
    }
  }

  return seededCount;
}

/**
 * Sync auth providers from environment variables to database.
 *
 * Logic per provider:
 * - If no DB row exists and env is complete => insert with isOverridden=false
 * - If DB row exists and isOverridden=false => compare env vs stored; if different, update from env
 * - If DB row exists and isOverridden=true => never touch, this is manually overridden
 */
async function importEnvAuthProvidersIfMissing(): Promise<void> {
  await syncOIDCProvider();
  await syncGitHubProvider();
  await syncGoogleProvider();
}

/**
 * Check if two config objects differ (deep comparison)
 * Treats undefined and missing keys as equivalent
 */
function configsDiffer<T extends Record<string, unknown>>(
  stored: T | null | undefined,
  env: T
): boolean {
  if (!stored) return true;

  // Use JSON serialization for deep comparison (handles nested objects)
  // JSON.stringify ignores undefined values, so we need to handle them consistently
  const normalizeForComparison = (obj: Record<string, unknown>): string => {
    return JSON.stringify(obj, (_, value) => (value === undefined ? null : value));
  };

  return normalizeForComparison(stored) !== normalizeForComparison(env);
}

/**
 * Sync OIDC provider from env to DB
 * - If env has config and DB doesn't: insert
 * - If env has config and DB has non-overridden config: update if different
 * - If env is empty and DB has non-overridden config: delete (fallback to password auth)
 * - If DB config is overridden: never touch
 */
async function syncOIDCProvider(): Promise<void> {
  const hasEnvConfig =
    SERVER_CONFIG.OIDC_ISSUER && SERVER_CONFIG.OIDC_CLIENT_ID && SERVER_CONFIG.OIDC_CLIENT_SECRET;

  const existing = await getConfig<AuthProviderOIDC>(ServerConfigKeys.AUTH_PROVIDER_OIDC, true);

  // If no env config, check if we need to remove env-managed DB config
  if (!hasEnvConfig) {
    if (existing && !existing.isOverridden) {
      await deleteConfig(ServerConfigKeys.AUTH_PROVIDER_OIDC);
      serverLogger.info("Removed OIDC provider (env credentials removed)");
    }

    return;
  }

  const envConfig: AuthProviderOIDC = {
    name: SERVER_CONFIG.OIDC_NAME,
    issuer: SERVER_CONFIG.OIDC_ISSUER!,
    clientId: SERVER_CONFIG.OIDC_CLIENT_ID!,
    clientSecret: SERVER_CONFIG.OIDC_CLIENT_SECRET!,
    wellknown: SERVER_CONFIG.OIDC_WELLKNOWN || undefined,
    isOverridden: false,
    claimConfig: {
      enabled: SERVER_CONFIG.OIDC_CLAIM_MAPPING_ENABLED,
      scopes: SERVER_CONFIG.OIDC_SCOPES,
      groupsClaim: SERVER_CONFIG.OIDC_GROUPS_CLAIM,
      adminGroup: SERVER_CONFIG.OIDC_ADMIN_GROUP,
      householdPrefix: SERVER_CONFIG.OIDC_HOUSEHOLD_GROUP_PREFIX,
    },
  };

  serverLogger.debug(
    {
      name: envConfig.name,
      issuer: envConfig.issuer,
      wellknown: envConfig.wellknown ?? "(auto-derived from issuer)",
      claimConfig: envConfig.claimConfig,
    },
    "OIDC env config loaded"
  );

  if (!existing) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_OIDC, envConfig, null, true);
    serverLogger.debug({ name: envConfig.name }, "Imported OIDC provider from env");

    return;
  }

  serverLogger.debug(
    {
      name: existing.name,
      issuer: existing.issuer,
      wellknown: existing.wellknown ?? "(auto-derived from issuer)",
      isOverridden: existing.isOverridden,
    },
    "OIDC DB config loaded"
  );

  if (existing.isOverridden) {
    serverLogger.debug("OIDC provider is overridden by admin, skipping env sync");

    return;
  }

  const storedComparable = { ...existing, isOverridden: undefined };
  const envComparable = { ...envConfig, isOverridden: undefined };

  if (configsDiffer(storedComparable, envComparable)) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_OIDC, envConfig, null, true);
    serverLogger.info(
      { name: envConfig.name, issuer: envConfig.issuer, wellknown: envConfig.wellknown },
      "Updated OIDC provider from env (config changed)"
    );
  }
}

/**
 * Sync GitHub provider from env to DB
 * - If env has config and DB doesn't: insert
 * - If env has config and DB has non-overridden config: update if different
 * - If env is empty and DB has non-overridden config: delete (fallback to password auth)
 * - If DB config is overridden: never touch
 */
async function syncGitHubProvider(): Promise<void> {
  const hasEnvConfig = SERVER_CONFIG.GITHUB_CLIENT_ID && SERVER_CONFIG.GITHUB_CLIENT_SECRET;

  const existing = await getConfig<AuthProviderGitHub>(ServerConfigKeys.AUTH_PROVIDER_GITHUB, true);

  // If no env config, check if we need to remove env-managed DB config
  if (!hasEnvConfig) {
    if (existing && !existing.isOverridden) {
      await deleteConfig(ServerConfigKeys.AUTH_PROVIDER_GITHUB);
      serverLogger.info("Removed GitHub provider (env credentials removed)");
    }

    return;
  }

  const envConfig: AuthProviderGitHub = {
    clientId: SERVER_CONFIG.GITHUB_CLIENT_ID!,
    clientSecret: SERVER_CONFIG.GITHUB_CLIENT_SECRET!,
    isOverridden: false,
  };

  if (!existing) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_GITHUB, envConfig, null, true);
    serverLogger.info("Imported GitHub provider from env");

    return;
  }

  if (existing.isOverridden) {
    serverLogger.debug("GitHub provider is overridden by admin, skipping env sync");

    return;
  }

  const storedComparable = { ...existing, isOverridden: undefined };
  const envComparable = { ...envConfig, isOverridden: undefined };

  if (configsDiffer(storedComparable, envComparable)) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_GITHUB, envConfig, null, true);
    serverLogger.info("Updated GitHub provider from env (config changed)");
  }
}

/**
 * Sync Google provider from env to DB
 * - If env has config and DB doesn't: insert
 * - If env has config and DB has non-overridden config: update if different
 * - If env is empty and DB has non-overridden config: delete (fallback to password auth)
 * - If DB config is overridden: never touch
 */
async function syncGoogleProvider(): Promise<void> {
  const hasEnvConfig = SERVER_CONFIG.GOOGLE_CLIENT_ID && SERVER_CONFIG.GOOGLE_CLIENT_SECRET;

  const existing = await getConfig<AuthProviderGoogle>(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, true);

  // If no env config, check if we need to remove env-managed DB config
  if (!hasEnvConfig) {
    if (existing && !existing.isOverridden) {
      await deleteConfig(ServerConfigKeys.AUTH_PROVIDER_GOOGLE);
      serverLogger.info("Removed Google provider (env credentials removed)");
    }

    return;
  }

  const envConfig: AuthProviderGoogle = {
    clientId: SERVER_CONFIG.GOOGLE_CLIENT_ID!,
    clientSecret: SERVER_CONFIG.GOOGLE_CLIENT_SECRET!,
    isOverridden: false,
  };

  if (!existing) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, envConfig, null, true);
    serverLogger.info("Imported Google provider from env");

    return;
  }

  if (existing.isOverridden) {
    serverLogger.debug("Google provider is overridden by admin, skipping env sync");

    return;
  }

  const storedComparable = { ...existing, isOverridden: undefined };
  const envComparable = { ...envConfig, isOverridden: undefined };

  if (configsDiffer(storedComparable, envComparable)) {
    await setConfig(ServerConfigKeys.AUTH_PROVIDER_GOOGLE, envConfig, null, true);
    serverLogger.info("Updated Google provider from env (config changed)");
  }
}

async function syncPrompts(): Promise<void> {
  const existing = await getConfig<PromptsConfig>(ServerConfigKeys.PROMPTS);

  if (!existing) {
    serverLogger.warn("Prompts config not found in DB, will be seeded");

    return;
  }

  if (existing.isOverridden) {
    serverLogger.debug("Prompts are overridden by admin, skipping file sync");

    return;
  }

  const defaultPrompts = loadDefaultPrompts();
  const storedComparable = {
    recipeExtraction: existing.recipeExtraction,
    unitConversion: existing.unitConversion,
  };

  if (configsDiffer(storedComparable, defaultPrompts)) {
    await setConfig(
      ServerConfigKeys.PROMPTS,
      { ...defaultPrompts, isOverridden: false },
      null,
      false
    );

    serverLogger.info("Updated prompts from default files (content changed)");
  }
}

/**
 * Sync timer keywords from default config file
 * Updates DB if file changes and user hasn't overridden
 */
async function syncTimerKeywords(): Promise<void> {
  const existing = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

  // If user has overridden, don't touch it
  if (existing?.isOverridden) {
    serverLogger.debug("Timer keywords are overridden by admin, skipping file sync");

    return;
  }

  const fileDefaults = { ...defaultTimerKeywords, isOverridden: false };

  // If no config exists, seed it
  if (!existing) {
    await setConfig(ServerConfigKeys.TIMER_KEYWORDS, fileDefaults, null, false);
    serverLogger.info("Seeded timer keywords from default config file");

    return;
  }

  // If config exists but isOverridden=false, check if file has changed
  const storedComparable = {
    enabled: existing.enabled,
    hours: existing.hours,
    minutes: existing.minutes,
    seconds: existing.seconds,
  };
  const fileComparable = {
    enabled: fileDefaults.enabled,
    hours: fileDefaults.hours,
    minutes: fileDefaults.minutes,
    seconds: fileDefaults.seconds,
  };

  if (configsDiffer(storedComparable, fileComparable)) {
    await setConfig(ServerConfigKeys.TIMER_KEYWORDS, fileDefaults, null, false);
    serverLogger.info("Updated timer keywords from default file (content changed)");
  }
}

/**
 * Export for testing - seeds timer keywords if not present or if not overridden
 */
export async function seedDefaultTimerKeywords(): Promise<void> {
  await syncTimerKeywords();
}

/**
 * Add any new locales from DEFAULT_LOCALE_CONFIG to the DB config.
 * Preserves existing locale settings (enabled/disabled state).
 * Respects ENABLED_LOCALES env var when adding new locales.
 */
async function syncLocales(): Promise<void> {
  const existing = await getConfig<I18nLocaleConfig>(ServerConfigKeys.LOCALE_CONFIG);

  if (!existing) {
    return;
  }

  const envEnabledLocales = SERVER_CONFIG.ENABLED_LOCALES;
  const hasEnvFilter = envEnabledLocales.length > 0;

  const newLocales: string[] = [];

  for (const [locale, entry] of Object.entries(DEFAULT_LOCALE_CONFIG.locales)) {
    if (!existing.locales[locale]) {
      newLocales.push(locale);
      // If ENABLED_LOCALES env is set, only enable if locale is in that list
      // Otherwise use the default enabled state
      const enabled = hasEnvFilter ? envEnabledLocales.includes(locale) : entry.enabled;

      existing.locales[locale] = { ...entry, enabled };
    }
  }

  if (newLocales.length > 0) {
    await setConfig(ServerConfigKeys.LOCALE_CONFIG, existing, null, false);
    serverLogger.info({ locales: newLocales }, "Added new locales to config");
  }
}

/**
 * Load default values from .default.json files
 * Used for "Restore to defaults" functionality
 */
export function getDefaultConfigValue(key: ServerConfigKey): unknown {
  switch (key) {
    case ServerConfigKeys.REGISTRATION_ENABLED:
      return true;
    case ServerConfigKeys.UNITS:
      return defaultUnits;
    case ServerConfigKeys.CONTENT_INDICATORS:
      return defaultContentIndicators;
    case ServerConfigKeys.RECURRENCE_CONFIG:
      return defaultRecurrenceConfig;
    case ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS:
      return 3;
    case ServerConfigKeys.AI_CONFIG:
      return {
        enabled: false,
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 1.0,
        maxTokens: 10000,
      };
    case ServerConfigKeys.VIDEO_CONFIG:
      return {
        enabled: false,
        maxLengthSeconds: 120,
        maxVideoFileSize: SERVER_CONFIG.MAX_VIDEO_FILE_SIZE,
        ytDlpVersion: "2025.11.12",
        transcriptionProvider: "disabled",
        transcriptionModel: "whisper-1",
      };
    case ServerConfigKeys.RECIPE_PERMISSION_POLICY:
      return DEFAULT_RECIPE_PERMISSION_POLICY;
    case ServerConfigKeys.PROMPTS:
      return { ...loadDefaultPrompts(), isOverridden: false };
    case ServerConfigKeys.LOCALE_CONFIG:
      return DEFAULT_LOCALE_CONFIG;
    case ServerConfigKeys.TIMER_KEYWORDS:
      return { ...defaultTimerKeywords, isOverridden: false };
    default:
      return null;
  }
}
