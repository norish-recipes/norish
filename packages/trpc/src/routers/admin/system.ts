import {
  AdminConfigKeySchema,
  SchedulerCleanupMonthsSchema,
  SENSITIVE_CONFIG_KEYS,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import { setConfig } from "@norish/db/repositories/server-config";
import { getDefaultConfigValue } from "@norish/shared-server/config/defaults";
import { forgetSpellingRules } from "@norish/shared-server/ingredients/resolver";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { masterKeyPinned, rotateKeyFile } from "@norish/shared-server/master-key";
import { config } from "@norish/shared-server/realtime/config";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/** The config every client reads, which a restore announces as an edit does. */
const READ_BY_CLIENTS = new Set<string>([
  ServerConfigKeys.UNITS,
  ServerConfigKeys.INGREDIENT_WORDS,
  ServerConfigKeys.RECURRENCE_CONFIG,
  ServerConfigKeys.TIMER_KEYWORDS,
  ServerConfigKeys.LOCALE_CONFIG,
]);

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
  .input(AdminConfigKeySchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, key: input }, "Restoring default config");

    const defaultValue = getDefaultConfigValue(input);

    if (defaultValue === null) {
      return { success: false, error: `No default value available for ${input}` };
    }

    const isSensitive = SENSITIVE_CONFIG_KEYS.includes(input);

    await setConfig(input, defaultValue, ctx.user.id, isSensitive);
    // Names are read by these two: the next one reads the restored words.
    if (input === ServerConfigKeys.UNITS || input === ServerConfigKeys.INGREDIENT_WORDS) {
      forgetSpellingRules();
    }
    if (READ_BY_CLIENTS.has(input)) void config.publish("changed", {}, undefined);

    return { success: true };
  });

/** Exit once the response is sent; a `restart: always` deployment starts the server again. */
function exitAfterResponse(): void {
  setTimeout(() => {
    log.info("Exiting process for restart...");
    process.exit(0);
  }, 500);
}

/**
 * Restart the server.
 * Schedules an exit for after the response is sent.
 */
const restartServer = adminProcedure.mutation(async ({ ctx }) => {
  log.info({ userId: ctx.user.id }, "Server restart requested by admin");
  exitAfterResponse();

  return { success: true };
});

/**
 * Rotate a generated Master Key: the new key file is on disk before the restart, whose boot
 * re-encrypts everything and ends every session. Never answers or logs a key.
 */
const rotateMasterKey = adminProcedure.mutation(async ({ ctx }) => {
  if (masterKeyPinned()) {
    return {
      success: false,
      error: "MASTER_KEY is set, so rotate it there with MASTER_KEY_PREVIOUS.",
    };
  }
  log.info({ userId: ctx.user.id }, "Master Key rotation requested by admin");
  let rotated: boolean;

  try {
    rotated = await rotateKeyFile();
  } catch (error) {
    log.error({ userId: ctx.user.id, err: error }, "Master Key rotation failed, nothing changed");

    return { success: false, error: "The new key could not be written, so nothing changed." };
  }
  if (!rotated) {
    log.error(
      { userId: ctx.user.id },
      "Master Key rotation refused: the key file does not hold the key this database is encrypted with"
    );

    return {
      success: false,
      error: "The key file does not hold this database's key, so nothing changed.",
    };
  }
  exitAfterResponse();

  return { success: true };
});

export const systemProcedures = router({
  updateSchedulerMonths,
  restoreDefault,
  restartServer,
  /** Whether MASTER_KEY pins the Master Key (env mode), decided as boot decides it. */
  masterKeyPinned: adminProcedure.query(() => ({ pinned: masterKeyPinned() })),
  rotateMasterKey,
});
