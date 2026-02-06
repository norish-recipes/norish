/**
 * Server Configuration Loader
 *
 * Simple async access to server configuration stored in the database.
 * Each call queries the database directly - no caching layer.
 *
 * Flow:
 * - Server code needs config => call getX() => queries DB => returns value
 * - Frontend needs config => use hook => fetches from API => API queries DB
 */

// Import defaults for fallback when DB has no value
import defaultUnits from "./units.default.json";
import defaultContentIndicators from "./content-indicators.default.json";
import defaultRecurrenceConfig from "./recurrence-config.default.json";
import defaultTimerKeywords from "./timer-keywords.default.json";

import {
  ServerConfigKeys,
  type UnitsMap,
  type ContentIndicatorsConfig,
  type RecurrenceConfig,
  type AIConfig,
  type VideoConfig,
  type RecipePermissionPolicy,
  type PromptsConfig,
  type AutoTaggingMode,
  type I18nLocaleConfig,
  type TimerKeywordsConfig,
  DEFAULT_RECIPE_PERMISSION_POLICY,
} from "@/server/db/zodSchemas/server-config";
import { getConfig } from "@/server/db/repositories/server-config";
import { SERVER_CONFIG } from "@/config/env-config-server";

// ============================================================================
// Configuration Getters - Each call queries the database
// ============================================================================

/**
 * Check if registration is enabled
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  const value = await getConfig<boolean>(ServerConfigKeys.REGISTRATION_ENABLED);

  return value ?? true;
}

/**
 * Get units configuration
 */
export async function getUnits(): Promise<UnitsMap> {
  const value = await getConfig<{ units: UnitsMap; isOverwritten: boolean }>(
    ServerConfigKeys.UNITS
  );

  return value?.units ?? (defaultUnits as UnitsMap);
}

/**
 * Get content indicators configuration
 */
export async function getContentIndicators(): Promise<ContentIndicatorsConfig> {
  const value = await getConfig<ContentIndicatorsConfig>(ServerConfigKeys.CONTENT_INDICATORS);

  return value ?? defaultContentIndicators;
}

/**
 * Check if recipe timers are enabled
 */
export async function isTimersEnabled(): Promise<boolean> {
  const config = await getTimerKeywords();

  return config.enabled ?? true;
}

/**
 * Get timer keywords configuration
 */
export async function getTimerKeywords(): Promise<TimerKeywordsConfig> {
  const value = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

  if (value && !value.isOverridden) {
    // User hasn't overridden, merge with defaults to get latest keywords
    return {
      ...defaultTimerKeywords,
      ...value,
      isOverridden: false,
    } as TimerKeywordsConfig;
  }

  return value ?? (defaultTimerKeywords as TimerKeywordsConfig);
}

/**
 * Get recurrence configuration
 */
export async function getRecurrenceConfig(): Promise<RecurrenceConfig> {
  const value = await getConfig<RecurrenceConfig>(ServerConfigKeys.RECURRENCE_CONFIG);

  return value ?? (defaultRecurrenceConfig as RecurrenceConfig);
}

/**
 * Get AI configuration
 * @param includeSecrets - If true, includes decrypted API keys
 */
export async function getAIConfig(includeSecrets = false): Promise<AIConfig | null> {
  return await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG, includeSecrets);
}

/**
 * Get video processing configuration (includes transcription settings)
 * @param includeSecrets - If true, includes decrypted API keys
 */
export async function getVideoConfig(includeSecrets = false): Promise<VideoConfig | null> {
  return await getConfig<VideoConfig>(ServerConfigKeys.VIDEO_CONFIG, includeSecrets);
}

/**
 * Get maximum video file size in bytes
 * Returns value from DB config, falls back to SERVER_CONFIG default if not configured
 */
export async function getMaxVideoFileSize(): Promise<number> {
  const videoConfig = await getConfig<VideoConfig>(ServerConfigKeys.VIDEO_CONFIG);

  return videoConfig?.maxVideoFileSize ?? SERVER_CONFIG.MAX_VIDEO_FILE_SIZE;
}

/**
 * Get scheduler cleanup months
 */
export async function getSchedulerCleanupMonths(): Promise<number> {
  const value = await getConfig<number>(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS);

  return value ?? 3;
}

/**
 * Get recipe permission policy
 */
export async function getRecipePermissionPolicy(): Promise<RecipePermissionPolicy> {
  const value = await getConfig<RecipePermissionPolicy>(ServerConfigKeys.RECIPE_PERMISSION_POLICY);

  return value ?? DEFAULT_RECIPE_PERMISSION_POLICY;
}

/**
 * Get prompts configuration
 */
export async function getPrompts(): Promise<PromptsConfig> {
  const value = await getConfig<PromptsConfig>(ServerConfigKeys.PROMPTS);

  // Prompts are seeded at startup, so this should always exist
  return value!;
}

/**
 * Check if AI features are enabled
 */
export async function isAIEnabled(): Promise<boolean> {
  const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);

  return aiConfig?.enabled ?? false;
}

/**
 * Check if imports should always use AI (skip structured parsers)
 * Only returns true if AI is enabled AND alwaysUseAI is set
 */
export async function shouldAlwaysUseAI(): Promise<boolean> {
  const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);

  return (aiConfig?.enabled && aiConfig?.alwaysUseAI) ?? false;
}

/**
 * Check if video parsing is enabled
 */
export async function isVideoParsingEnabled(): Promise<boolean> {
  const videoConfig = await getConfig<VideoConfig>(ServerConfigKeys.VIDEO_CONFIG);

  return ((await isAIEnabled()) && videoConfig?.enabled) ?? false;
}

/**
 * Get auto-tagging mode
 * Returns "disabled" if AI is not enabled
 */
export async function getAutoTaggingMode(): Promise<AutoTaggingMode> {
  const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);

  if (!aiConfig?.enabled) {
    return "disabled";
  }

  return aiConfig.autoTaggingMode ?? "disabled";
}

// ============================================================================
// Locale Configuration
// ============================================================================

/**
 * Default locale configuration with all available locales.
 * To add a new locale:
 * 1. Add translation files to i18n/messages/{locale}/
 * 2. Add the locale entry here
 */
export const DEFAULT_LOCALE_CONFIG: I18nLocaleConfig = {
  defaultLocale: "en",
  locales: {
    en: { name: "English", enabled: true },
    nl: { name: "Nederlands", enabled: true },
    "de-formal": { name: "Deutsch (Sie)", enabled: true },
    "de-informal": { name: "Deutsch (Du)", enabled: true },
    fr: { name: "Français", enabled: true },
  },
};

/**
 * Get the full locale configuration.
 *
 * Priority:
 * 1. Database config (if admin has saved settings via UI)
 * 2. Environment variable ENABLED_LOCALES (filters which locales are enabled)
 * 3. Default config (all locales enabled)
 */
export async function getLocaleConfig(): Promise<I18nLocaleConfig> {
  try {
    const dbConfig = await getConfig<I18nLocaleConfig>(ServerConfigKeys.LOCALE_CONFIG);

    if (dbConfig) {
      return dbConfig;
    }
  } catch {
    // DB unavailable (e.g., during build/CI), fall through to env config
  }

  // 2. Build from env var + defaults
  return buildLocaleConfigFromEnv();
}

/**
 * Build locale config from environment variables.
 * Exported for use by seed-config.ts to avoid duplication.
 */
export function buildLocaleConfigFromEnv(): I18nLocaleConfig {
  const envEnabledLocales = SERVER_CONFIG.ENABLED_LOCALES;
  const envDefaultLocale = SERVER_CONFIG.DEFAULT_LOCALE;

  // Start with default config
  const config: I18nLocaleConfig = {
    defaultLocale: envDefaultLocale || DEFAULT_LOCALE_CONFIG.defaultLocale,
    locales: JSON.parse(JSON.stringify(DEFAULT_LOCALE_CONFIG.locales)),
  };

  // If ENABLED_LOCALES env is set, filter enabled status
  if (envEnabledLocales.length > 0) {
    for (const locale of Object.keys(config.locales)) {
      config.locales[locale] = {
        ...config.locales[locale],
        enabled: envEnabledLocales.includes(locale),
      };
    }
  }

  // Ensure default locale is valid - if not in enabled locales, use first enabled
  const enabledLocales = Object.entries(config.locales)
    .filter(([_, entry]) => entry.enabled)
    .map(([code]) => code);

  if (!enabledLocales.includes(config.defaultLocale)) {
    config.defaultLocale = enabledLocales[0] || "en";
  }

  return config;
}

/**
 * Get list of enabled locale codes
 */
export async function getEnabledLocales(): Promise<string[]> {
  const config = await getLocaleConfig();

  return Object.entries(config.locales)
    .filter(([_, entry]) => entry.enabled)
    .map(([code]) => code);
}

/**
 * Get the default locale code
 */
export async function getDefaultLocale(): Promise<string> {
  const config = await getLocaleConfig();

  return config.defaultLocale;
}

/**
 * Check if a locale code is valid and enabled
 */
export async function isValidEnabledLocale(locale: string): Promise<boolean> {
  const enabledLocales = await getEnabledLocales();

  return enabledLocales.includes(locale);
}

// ============================================================================
// Type exports for convenience
// ============================================================================

export type {
  UnitsMap,
  ContentIndicatorsConfig,
  RecurrenceConfig,
  AIConfig,
  VideoConfig,
  RecipePermissionPolicy,
  PromptsConfig,
  I18nLocaleConfig,
  TimerKeywordsConfig,
};
