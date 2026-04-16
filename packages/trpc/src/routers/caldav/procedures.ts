import { TRPCError } from "@trpc/server";

import type {
  CalDavCalendarInfo,
  ConnectionTestResult,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";
import {
  deleteCaldavConfig,
  getCaldavConfigDecrypted,
  getCaldavConfigWithoutPassword,
  saveCaldavConfig,
} from "@norish/db/repositories/caldav-config";
import {
  getCaldavSyncStatusesByUser,
  getSyncStatusSummary,
} from "@norish/db/repositories/caldav-sync-status";
import { CalDavClient, testCalDavConnection } from "@norish/shared-server/caldav/client";
import { retryFailedSyncs, syncAllFutureItems } from "@norish/shared-server/caldav/sync";
import { createLogger } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { caldavEmitter } from "./emitter";
import {
  DeleteCaldavConfigInputSchema,
  FetchCalendarsInputSchema,
  GetSyncStatusInputSchema,
  SaveCaldavConfigInputSchema,
  TestCaldavConnectionInputSchema,
} from "./types";

const log = createLogger("caldav-procedures");

export const caldavRouter = router({
  /**
   * Get CalDAV configuration for the current user (without password).
   */
  getConfig: authedProcedure.query(
    async ({ ctx }): Promise<UserCaldavConfigWithoutPasswordDto | null> => {
      const userId = ctx.user.id;

      const config = await getCaldavConfigWithoutPassword(userId);

      if (!config) {
        return null;
      }

      return config;
    }
  ),

  /**
   * Get the decrypted password for config editing.
   */
  getPassword: authedProcedure.query(async ({ ctx }): Promise<string | null> => {
    const userId = ctx.user.id;

    const config = await getCaldavConfigDecrypted(userId);

    return config?.password || null;
  }),

  saveConfig: authedProcedure
    .input(SaveCaldavConfigInputSchema)
    .mutation(async ({ ctx, input }): Promise<UserCaldavConfigWithoutPasswordDto> => {
      const userId = ctx.user.id;

      log.info({ userId }, "Saving CalDAV configuration");

      // When updating, use existing password if not provided, as this is not sent when updating
      let password = input.password;

      if (!password) {
        const existingConfig = await getCaldavConfigDecrypted(userId);

        if (!existingConfig?.password) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Password is required for new configurations",
          });
        }

        password = existingConfig.password;
      }

      const result = await saveCaldavConfig(userId, {
        version: input.version,
        serverUrl: input.serverUrl,
        calendarUrl: input.calendarUrl ?? null,
        username: input.username,
        password,
        enabled: input.enabled,
        breakfastTime: input.breakfastTime,
        lunchTime: input.lunchTime,
        dinnerTime: input.dinnerTime,
        snackTime: input.snackTime,
      });

      if (result.stale) {
        log.info({ userId, version: input.version }, "Ignoring stale CalDAV config save");

        const currentConfig = await getCaldavConfigWithoutPassword(userId);

        if (!currentConfig) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "CalDAV configuration changed before this update was applied",
          });
        }

        return currentConfig;
      }

      // Get the saved config without password for response
      const configWithoutPassword = await getCaldavConfigWithoutPassword(userId);

      if (!configWithoutPassword) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve saved configuration",
        });
      }

      // Emit config saved event
      caldavEmitter.emitToUser(userId, "configSaved", { config: configWithoutPassword });

      // If enabled, trigger initial sync of all future items
      if (input.enabled) {
        log.info({ userId }, "CalDAV enabled - starting initial sync");

        // Run sync in background, don't wait
        syncAllFutureItems(userId)
          .then((result) => {
            log.info({ userId, ...result }, "Initial CalDAV sync completed");
            caldavEmitter.emitToUser(userId, "initialSyncComplete", {
              timestamp: new Date().toISOString(),
              totalSynced: result.totalSynced,
              totalFailed: result.totalFailed,
            });
          })
          .catch((err) => {
            log.error({ err, userId }, "Initial CalDAV sync failed");
          });
      }

      return configWithoutPassword;
    }),

  /**
   * Test CalDAV connection without saving. Returns available calendars on success.
   */
  testConnection: authedProcedure
    .input(TestCaldavConnectionInputSchema)
    .mutation(async ({ input }): Promise<ConnectionTestResult> => {
      return testCalDavConnection(input.serverUrl, input.username, input.password);
    }),

  /**
   * Fetch available calendars from a CalDAV server.
   */
  fetchCalendars: authedProcedure
    .input(FetchCalendarsInputSchema)
    .mutation(async ({ input }): Promise<CalDavCalendarInfo[]> => {
      const client = new CalDavClient({
        serverUrl: input.serverUrl,
        username: input.username,
        password: input.password,
      });

      return client.fetchCalendars();
    }),

  /**
   * Check connection status using stored credentials.
   */
  checkConnection: authedProcedure.query(async ({ ctx }): Promise<ConnectionTestResult> => {
    const userId = ctx.user.id;
    const config = await getCaldavConfigDecrypted(userId);

    if (!config) {
      return {
        success: false,
        message: "No configuration found",
      };
    }

    try {
      const client = new CalDavClient({
        serverUrl: config.serverUrl,
        calendarUrl: config.calendarUrl ?? undefined,
        username: config.username,
        password: config.password,
      });

      return client.testConnection();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }),

  /**
   * Delete CalDAV configuration.
   */
  deleteConfig: authedProcedure
    .input(DeleteCaldavConfigInputSchema)
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const userId = ctx.user.id;

      log.info({ userId, deleteEvents: input.deleteEvents }, "Deleting CalDAV configuration");

      const result = await deleteCaldavConfig(userId, input.version);

      if (result.stale) {
        log.info({ userId, version: input.version }, "Ignoring stale CalDAV config delete");

        return { success: true };
      }

      // Emit config deleted event
      caldavEmitter.emitToUser(userId, "configSaved", { config: null });

      return { success: true };
    }),

  /**
   * Get sync status list with pagination.
   */
  getSyncStatus: authedProcedure.input(GetSyncStatusInputSchema).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;

    const filters = input.statusFilter
      ? [input.statusFilter as "pending" | "synced" | "failed"]
      : undefined;

    const result = await getCaldavSyncStatusesByUser(userId, filters, input.page, input.pageSize);

    return {
      statuses: result.items,
      total: result.total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }),

  /**
   * Get sync status summary counts.
   */
  getSummary: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    return getSyncStatusSummary(userId);
  }),

  triggerSync: authedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    log.info({ userId }, "Manually triggering CalDAV sync");

    // Emit sync started event
    caldavEmitter.emitToUser(userId, "syncStarted", {
      timestamp: new Date().toISOString(),
    });

    // Run retry in background
    retryFailedSyncs(userId)
      .then((result) => {
        log.info({ userId, ...result }, "Manual CalDAV sync completed");
        caldavEmitter.emitToUser(userId, "initialSyncComplete", {
          timestamp: new Date().toISOString(),
          totalSynced: result.totalRetried,
          totalFailed: result.totalFailed,
        });
      })
      .catch((err) => {
        log.error({ err, userId }, "Manual CalDAV sync failed");
      });

    return { started: true };
  }),

  syncAll: authedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;

    log.info({ userId }, "Starting full CalDAV sync");

    // Emit sync started event
    caldavEmitter.emitToUser(userId, "syncStarted", {
      timestamp: new Date().toISOString(),
    });

    // Run sync in background
    syncAllFutureItems(userId)
      .then((result) => {
        log.info({ userId, ...result }, "Full CalDAV sync completed");
        caldavEmitter.emitToUser(userId, "initialSyncComplete", {
          timestamp: new Date().toISOString(),
          totalSynced: result.totalSynced,
          totalFailed: result.totalFailed,
        });
      })
      .catch((err) => {
        log.error({ err, userId }, "Full CalDAV sync failed");
      });

    return { started: true };
  }),
});

export type CaldavRouter = typeof caldavRouter;
