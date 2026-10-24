import { TRPCError } from "@trpc/server";

import { getAvailableProviders, isPasswordAuthEnabled } from "@norish/auth/providers";
import { buildInternalParserApiUrl, SERVER_CONFIG } from "@norish/config/env-config-server";
import { getDatabaseHealth } from "@norish/db/drizzle";
import { listCuisines } from "@norish/db/repositories/cuisines";
import { listAllTagNames, listTagNamesForUsers } from "@norish/db/repositories/tags";
import {
  getIngredientWords,
  getLocaleConfig,
  getRecipePermissionPolicy,
  getRecurrenceConfig,
  getTimerKeywords,
  getUnits,
  isRegistrationEnabled,
  isTimersEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { getValkeyHealth } from "@norish/shared-server/valkey/client";

import { authedProcedure } from "../../middleware";
import { publicProcedure, router } from "../../trpc";
import {
  liveResponseSchema,
  parserHealthSchema,
  readyResponseSchema,
} from "./config-openapi-types";

/** Ready only reports the parser, so it waits on it no longer than on Valkey's ping. */
const READY_PARSER_TIMEOUT_MS = 2_000;

/** The internal parser's own health check, which Norish runs as its child process. */
async function getParserHealth(timeoutMs = SERVER_CONFIG.PARSER_API_TIMEOUT_MS) {
  try {
    const response = await fetch(buildInternalParserApiUrl("/health"), {
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        status: "error" as const,
        statusCode: response.status,
      };
    }

    const parsedHealth = parserHealthSchema.parse(await response.json());

    if (parsedHealth.status !== "ok") {
      return {
        status: parsedHealth.status ?? "unknown",
        recipeScrapersVersion: parsedHealth.recipeScrapersVersion,
      };
    }

    return {
      status: "ok" as const,
      recipeScrapersVersion: parsedHealth.recipeScrapersVersion,
    };
  } catch {
    return {
      status: "unreachable" as const,
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
 * Get all unique tag names visible to the authenticated user. Scoped to the
 * user's household unless the recipe view policy (or server admin role)
 * grants access to all recipes.
 */
const tags = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting tags");

  const policy = await getRecipePermissionPolicy();
  const tagNames =
    policy.view === "everyone" || ctx.isServerAdmin
      ? await listAllTagNames()
      : await listTagNamesForUsers(ctx.userIds);

  return { tags: tagNames };
});

/**
 * Get the deployment's Cuisine vocabulary.
 *
 * Unscoped on purpose: unlike Tags, which grow out of whichever recipes a user
 * can see, the vocabulary is one administrator-owned list. An editor picks from
 * exactly the same list AI does, which is what makes manual entries match
 * inferred ones.
 */
const cuisines = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting the Cuisine vocabulary");

  return { cuisines: await listCuisines() };
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
 * The ingredient words names are read by, which the browser matches text
 * nothing has resolved yet on, as the resolver does (ADR-0037).
 */
const ingredientWords = authedProcedure.query(async () => await getIngredientWords());

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

/**
 * Whether to restart Norish: only what a restart can fix. Norish runs the
 * parser itself, so a hung parser fails it; Postgres and Valkey do not, since
 * restarting Norish fixes neither.
 */
export const healthLive = publicProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/health/live",
      protect: false,
      tags: ["Health"],
      summary: "Check whether Norish is alive",
      description:
        "Answers 200 while the server responds and its internal parser answers its own health check. Checks neither the database nor Valkey. Point restart probes (Docker HEALTHCHECK, Kubernetes liveness) here.",
      successDescription: "The server and its parser are alive.",
      errorResponses: { 503: "The parser service is unhealthy or unreachable" },
    },
  })
  .output(liveResponseSchema)
  .query(async () => {
    const parser = await getParserHealth();

    if (parser.status !== "ok") {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: `Parser service is ${parser.status}`,
      });
    }

    return { status: "ok" as const, parser };
  });

/**
 * Whether to send Norish traffic: Postgres and Valkey must answer. The parser
 * is reported but never fails it, since only URL imports need it.
 */
export const healthReady = publicProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/health/ready",
      protect: false,
      tags: ["Health"],
      summary: "Check whether Norish is ready for traffic",
      description:
        "Answers 503 while the database or Valkey is unreachable, and 200 otherwise. The parser's state is in the response but does not fail the check. Point readiness probes and load balancers here.",
      successDescription: "The database and Valkey are healthy.",
      errorResponses: { 503: "The database or Valkey is unhealthy or unreachable" },
    },
  })
  .output(readyResponseSchema)
  .query(async () => {
    const [db, valkey, parser] = await Promise.all([
      getDatabaseHealth(),
      getValkeyHealth(),
      getParserHealth(READY_PARSER_TIMEOUT_MS),
    ]);

    if (db.status !== "ok" || valkey.status !== "ok") {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: db.status !== "ok" ? `Database is ${db.status}` : `Valkey is ${valkey.status}`,
      });
    }

    return { status: "ok" as const, db, valkey, parser };
  });

export const configProcedures = router({
  localeConfig,
  tags,
  cuisines,
  units,
  ingredientWords,
  recurrenceConfig,
  uploadLimits,
  timersEnabled,
  timerKeywords,
  authProviders,
  healthLive,
  healthReady,
});
