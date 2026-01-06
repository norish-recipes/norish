import { router, publicProcedure } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { getUnits, getRecurrenceConfig, getLocaleConfig } from "@/config/server-config-loader";
import { listAllTagNames } from "@/server/db/repositories/tags";
import { getVersionInfo } from "@/server/version";

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
 * Get version information for update checking.
 * Returns current installed version and latest available from GitHub.
 */
const version = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting version info");

  return getVersionInfo();
});

export const configProcedures = router({
  localeConfig,
  tags,
  units,
  recurrenceConfig,
  version,
});
