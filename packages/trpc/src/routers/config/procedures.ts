import { TRPCError } from "@trpc/server";

import { getAvailableProviders, isPasswordAuthEnabled } from "@norish/auth/providers";
import { buildInternalParserApiUrl, SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  getLocaleConfig,
  getRecurrenceConfig,
  getTimerKeywords,
  getUnits,
  isRegistrationEnabled,
  isTimersEnabled,
} from "@norish/config/server-config-loader";
import { listAllTagNames } from "@norish/db/repositories/tags";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { publicProcedure, router } from "../../trpc";
import { healthyResponseSchema, parserHealthSchema } from "./config-openapi-types";

export async function getServiceHealth() {
  const parserHealthUrl = buildInternalParserApiUrl("/health");

  try {
    const response = await fetch(parserHealthUrl, {
      signal: AbortSignal.timeout(SERVER_CONFIG.PARSER_API_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        status: "degraded" as const,
        parser: {
          status: "error",
          statusCode: response.status,
        },
      };
    }

    const parserHealth = parserHealthSchema.parse(await response.json());

    if (parserHealth.status !== "ok") {
      return {
        status: "degraded" as const,
        parser: {
          status: parserHealth.status ?? "unknown",
          recipeScrapersVersion: parserHealth.recipeScrapersVersion,
        },
      };
    }

    return {
      status: "ok" as const,
      parser: {
        status: "ok" as const,
        recipeScrapersVersion: parserHealth.recipeScrapersVersion,
      },
    };
  } catch {
    return {
      status: "degraded" as const,
      parser: {
        status: "unreachable",
      },
    };
  }
}

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
const uploadLimits = authedProcedure.query(() => {
  return {
    maxAvatarSize: SERVER_CONFIG.MAX_AVATAR_FILE_SIZE,
    maxImageSize: SERVER_CONFIG.MAX_IMAGE_FILE_SIZE,
    maxVideoSize: SERVER_CONFIG.MAX_VIDEO_FILE_SIZE,
  };
});

/**
 * Check if recipe timers are enabled globally
 */
const timersEnabled = authedProcedure.query(async () => {
  return await isTimersEnabled();
});

/**
 * Get timer keywords configuration
 */
const timerKeywords = authedProcedure.query(async () => {
  const config = await getTimerKeywords();

  return config;
});

/**
 * Get available authentication providers and registration status for the login UI.
 *
 * Public (unauthenticated) procedure so mobile and other unauthenticated
 * clients can discover which providers are configured before a session exists.
 * Reuses the same `getAvailableProviders` logic used by the web login page.
 */
const authProviders = publicProcedure.query(async () => {
  log.debug("Getting available auth providers");

  const [providers, registrationEnabled, passwordAuthEnabled] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
    isPasswordAuthEnabled(),
  ]);

  return { providers, registrationEnabled, passwordAuthEnabled };
});

export const health = publicProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/health",
      protect: false,
      tags: ["Health"],
      summary: "Check API health",
      description:
        "Reports API availability and verifies the internal parser service is reachable and healthy.",
      successDescription: "The API and parser service are healthy.",
      errorResponses: {
        503: "The API is up but the parser service is unhealthy or unreachable",
      },
    },
  })
  .output(healthyResponseSchema)
  .query(async () => {
    const health = await getServiceHealth();

    if (health.status !== "ok") {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `Parser service is ${health.parser.status}`,
      });
    }

    return health;
  });

export const configProcedures = router({
  localeConfig,
  tags,
  units,
  recurrenceConfig,
  uploadLimits,
  timersEnabled,
  timerKeywords,
  authProviders,
  health,
});
