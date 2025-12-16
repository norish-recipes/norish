import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, getConfig } from "@/server/db/repositories/server-config";
import {
  ServerConfigKeys,
  ContentIndicatorsSchema,
  UnitsMapSchema,
  RecurrenceConfigSchema,
  PromptsConfigInputSchema,
  type PromptsConfig,
} from "@/server/db/zodSchemas/server-config";

/**
 * Update content indicators config.
 * Accepts a JSON string that gets parsed and validated.
 */
const updateContentIndicators = adminProcedure
  .input(z.string())
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating content indicators");

    let parsed: unknown;

    try {
      parsed = JSON.parse(input);
    } catch {
      return { success: false, error: "Invalid JSON format" };
    }

    const result = ContentIndicatorsSchema.safeParse(parsed);

    if (!result.success) {
      return { success: false, error: result.error.message };
    }

    await setConfig(ServerConfigKeys.CONTENT_INDICATORS, result.data, ctx.user.id, false);

    return { success: true };
  });

/**
 * Update units config.
 * Accepts a JSON string that gets parsed and validated.
 */
const updateUnits = adminProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id }, "Updating units config");

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }

  const result = UnitsMapSchema.safeParse(parsed);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  await setConfig(ServerConfigKeys.UNITS, result.data, ctx.user.id, false);

  return { success: true };
});

/**
 * Update recurrence config.
 * Accepts a JSON string that gets parsed and validated.
 */
const updateRecurrenceConfig = adminProcedure.input(z.string()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id }, "Updating recurrence config");

  let parsed: unknown;

  try {
    parsed = JSON.parse(input);
  } catch {
    return { success: false, error: "Invalid JSON format" };
  }

  const result = RecurrenceConfigSchema.safeParse(parsed);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  await setConfig(ServerConfigKeys.RECURRENCE_CONFIG, result.data, ctx.user.id, false);

  return { success: true };
});

/**
 * Get prompts config.
 * Returns the current prompts from the database.
 */
const getPrompts = adminProcedure.query(async () => {
  return await getConfig<PromptsConfig>(ServerConfigKeys.PROMPTS);
});

/**
 * Update prompts config.
 * Accepts prompt strings and marks as admin-overridden.
 */
const updatePrompts = adminProcedure
  .input(PromptsConfigInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating prompts config");

    // Mark as overridden
    await setConfig(
      ServerConfigKeys.PROMPTS,
      { ...input, isOverridden: true },
      ctx.user.id,
      false
    );

    return { success: true };
  });

export const contentConfigProcedures = router({
  updateContentIndicators,
  updateUnits,
  updateRecurrenceConfig,
  getPrompts,
  updatePrompts,
});
