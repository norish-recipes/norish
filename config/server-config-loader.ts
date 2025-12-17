/**
 * Server Configuration Loader
 *
 * Simple async access to server configuration stored in the database.
 * Each call queries the database directly - no caching layer.
 *
 * Flow:
 * - Server code needs config → call getX() → queries DB → returns value
 * - Frontend needs config → use hook → fetches from API → API queries DB
 */

// Import defaults for fallback when DB has no value
import defaultUnits from "./units.default.json";
import defaultContentIndicators from "./content-indicators.default.json";
import defaultRecurrenceConfig from "./recurrence-config.default.json";

import {
  ServerConfigKeys,
  type UnitsMap,
  type ContentIndicatorsConfig,
  type RecurrenceConfig,
  type AIConfig,
  type VideoConfig,
  type RecipePermissionPolicy,
  type PromptsConfig,
  DEFAULT_RECIPE_PERMISSION_POLICY,
} from "@/server/db/zodSchemas/server-config";
import { getConfig } from "@/server/db/repositories/server-config";

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
  const value = await getConfig<UnitsMap>(ServerConfigKeys.UNITS);

  return value ?? (defaultUnits as UnitsMap);
}

/**
 * Get content indicators configuration
 */
export async function getContentIndicators(): Promise<ContentIndicatorsConfig> {
  const value = await getConfig<ContentIndicatorsConfig>(ServerConfigKeys.CONTENT_INDICATORS);

  return value ?? defaultContentIndicators;
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
};
