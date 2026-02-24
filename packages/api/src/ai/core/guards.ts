/**
 * AI feature guards.
 *
 * Provides functions to check if AI features are enabled
 * and to require AI as a precondition.
 */

import { getAIConfig } from "@norish/config/server-config-loader";

import type { AIResult } from "./types";
import { aiError } from "./types";

/**
 * Check if AI features are enabled.
 * Queries the database for current configuration.
 */
export async function isAIEnabled(): Promise<boolean> {
  const aiConfig = await getAIConfig();

  return aiConfig?.enabled ?? false;
}

/**
 * Check if imports should always use AI (skip structured parsers).
 * Only returns true if AI is enabled AND alwaysUseAI is set.
 */
export async function shouldAlwaysUseAI(): Promise<boolean> {
  const aiConfig = await getAIConfig();

  return (aiConfig?.enabled && aiConfig?.alwaysUseAI) ?? false;
}

/**
 * Guard that returns an error result if AI is disabled.
 * Use this at the start of AI feature functions.
 *
 * @example
 * ```ts
 * const guard = await requireAI();
 * if (guard) return guard; // AI is disabled
 * // Continue with AI operation...
 * ```
 */
export async function requireAI<T>(): Promise<AIResult<T> | null> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    return aiError("AI features are disabled", "AI_DISABLED");
  }

  return null;
}

/**
 * Require AI and throw if disabled.
 * Use this when you want to throw instead of returning an error result.
 */
export async function requireAIOrThrow(): Promise<void> {
  const enabled = await isAIEnabled();

  if (!enabled) {
    throw new Error("AI features are disabled. Enable them in the admin settings.");
  }
}
