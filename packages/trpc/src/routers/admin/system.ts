import { z } from "zod";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import {
  SchedulerCleanupMonthsSchema,
  SENSITIVE_CONFIG_KEYS,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { getDefaultConfigValue } from "@norish/shared-server/config/defaults";
import { forgetSpellingRules } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Update scheduler cleanup months.
 */
const updateSchedulerMonths = adminProcedure
  .input(SchedulerCleanupMonthsSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, months: input }, "Updating scheduler cleanup months");

    await setConfig(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS, input, ctx.user.id, false);

    return { success: true };
  });

/**
 * Restore a config to its default value.
 */
const restoreDefault = adminProcedure
  .input(z.enum(ServerConfigKeys))
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, key: input }, "Restoring default config");

    const defaultValue = getDefaultConfigValue(input as ServerConfigKey);

    if (defaultValue === null) {
      return { success: false, error: `No default value available for ${input}` };
    }

    const isSensitive = SENSITIVE_CONFIG_KEYS.includes(input as ServerConfigKey);

    await setConfig(input as ServerConfigKey, defaultValue, ctx.user.id, isSensitive);
    // Names are read by these two: the next one reads the restored words.
    if (input === ServerConfigKeys.UNITS || input === ServerConfigKeys.INGREDIENT_WORDS) {
      forgetSpellingRules();
    }

    return { success: true };
  });

/**
 * Restart the server.
 * Schedules an exit for after the response is sent.
 */
const restartServer = adminProcedure.mutation(async ({ ctx }) => {
  log.info({ userId: ctx.user.id }, "Server restart requested by admin");

  // Schedule the exit for after the response is sent
  setTimeout(() => {
    log.info("Exiting process for restart...");
    process.exit(0);
  }, 500);

  return { success: true };
});

export const systemProcedures = router({
  updateSchedulerMonths,
  restoreDefault,
  restartServer,
});
