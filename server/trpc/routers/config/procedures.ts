import { router, publicProcedure } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import {
  getUnits,
  getRecurrenceConfig,
  getLocaleConfig,
  isTimersEnabled,
  getTimerKeywords,
} from "@/config/server-config-loader";
import { listAllTagNames } from "@/server/db/repositories/tags";
import { SERVER_CONFIG } from "@/config/env-config-server";

/**
 * Get locale configuration (enabled locales and default locale)
 */
const localeConfig = publicProcedure.query(async () => {
  const config = await getLocaleConfig();

  // Return a simplified structure for the client
  const enabledLocales = Object.entries(config.locales)
    .filter(([_, entry]) => entry.enabled)
    .map(([code, entry]) => ({
      code,
      name: entry.name,
    }));

  return {
    defaultLocale: config.defaultLocale,
    enabledLocales,
  };
});

/**
 * Get all unique tag names for the authenticated user's household
 */
const tags = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting tags");

  const tagNames = await listAllTagNames();

  return { tags: tagNames };
});

/**
 * Get units configuration for ingredient parsing
 * Units rarely change, safe to cache aggressively on client
 */
const units = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting units config");

  const unitsMap = await getUnits();

  return unitsMap;
});

/**
 * Get recurrence configuration for natural language parsing
 */
const recurrenceConfig = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting recurrence config");

  const config = await getRecurrenceConfig();

  return config;
});

/**
 * Get upload size limits from server configuration.
 * These are configurable via environment variables.
 */
const uploadLimits = publicProcedure.query(() => {
  return {
    maxAvatarSize: SERVER_CONFIG.MAX_AVATAR_FILE_SIZE,
    maxImageSize: SERVER_CONFIG.MAX_IMAGE_FILE_SIZE,
    maxVideoSize: SERVER_CONFIG.MAX_VIDEO_FILE_SIZE,
  };
});

/**
 * Check if recipe timers are enabled globally
 */
const timersEnabled = publicProcedure.query(async () => {
  return await isTimersEnabled();
});

/**
 * Get timer keywords configuration
 */
const timerKeywords = publicProcedure.query(async () => {
  log.debug("Getting timer keywords config");

  const config = await getTimerKeywords();

  return config;
});

export const configProcedures = router({
  localeConfig,
  tags,
  units,
  recurrenceConfig,
  uploadLimits,
  timersEnabled,
  timerKeywords,
});
