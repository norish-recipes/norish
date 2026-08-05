import { z } from "zod";

import type { TimerKeywordsConfig } from "@norish/config/zod/server-config";
import {
  ContentIndicatorsSchema,
  PromptsConfigInputSchema,
  RecurrenceConfigSchema,
  ServerConfigKeys,
  TimerKeywordsInputSchema,
  UnitsMapSchema,
} from "@norish/config/zod/server-config";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { getEffectivePrompts, loadDefaultPrompts } from "@norish/shared-server/ai/prompts/loader";
import { pruneToOverrides } from "@norish/shared-server/ai/prompts/overrides";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

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
 * Marks the config as overridden by admin.
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

  // Wrap units and mark as overridden
  await setConfig(
    ServerConfigKeys.UNITS,
    { units: result.data, isOverridden: true },
    ctx.user.id,
    false
  );

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
 * Get prompts for the admin surface: stored overrides merged over the
 * shipped defaults, so a release's new prompt text shows up unless the
 * administrator wrote their own.
 */
const getPrompts = adminProcedure.query(async () => {
  const { values, overriddenFields } = await getEffectivePrompts();

  return { ...values, isOverridden: overriddenFields.length > 0 };
});

/**
 * Update prompts config.
 *
 * Only genuine overrides are stored: a submitted prompt equal to the shipped
 * default (or blank) carries no intent and is dropped, so saving the form
 * never pins prompts the administrator did not change — and reverting a
 * prompt to the default text un-pins it.
 */
const updatePrompts = adminProcedure
  .input(PromptsConfigInputSchema)
  .mutation(async ({ input, ctx }) => {
    const { overrides } = pruneToOverrides(input, loadDefaultPrompts());

    log.info(
      { userId: ctx.user.id, overriddenFields: Object.keys(overrides) },
      "Updating prompts config"
    );

    await setConfig(ServerConfigKeys.PROMPTS, overrides, ctx.user.id, false);

    return { success: true };
  });

/**
 * Get timer keywords config.
 * Returns the current timer keywords from the database.
 */
const getTimerKeywords = adminProcedure.query(async () => {
  return await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
});

/**
 * Update timer keywords config.
 * Accepts keywords config and marks as admin-overridden.
 */
const updateTimerKeywords = adminProcedure
  .input(TimerKeywordsInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating timer keywords config");

    // Mark as overridden
    await setConfig(
      ServerConfigKeys.TIMER_KEYWORDS,
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
  getTimerKeywords,
  updateTimerKeywords,
});
