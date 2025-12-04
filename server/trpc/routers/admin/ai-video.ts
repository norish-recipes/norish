import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";
import { permissionsEmitter } from "../permissions/emitter";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, getConfig } from "@/server/db/repositories/server-config";
import { testAIEndpoint as testAIEndpointFn } from "@/server/auth/connection-tests";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { getDefaultConfigValue } from "@/server/startup/seed-config";
import {
  ServerConfigKeys,
  AIConfigSchema,
  VideoConfigSchema,
  type AIConfig,
  type ServerConfigKey,
  type PromptConfig,
} from "@/server/db/zodSchemas/server-config";

const PromptNameSchema = z.enum(["recipe-extraction", "unit-conversion"]);

type PromptName = z.infer<typeof PromptNameSchema>;

const PROMPT_NAME_TO_CONFIG_KEY: Record<PromptName, ServerConfigKey> = {
  "recipe-extraction": ServerConfigKeys.PROMPT_RECIPE_EXTRACTION,
  "unit-conversion": ServerConfigKeys.PROMPT_UNIT_CONVERSION,
};

/**
 * Get the default prompt content from seed-config
 */
function getDefaultPromptContent(name: PromptName): string {
  const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];
  const defaultValue = getDefaultConfigValue(configKey) as PromptConfig | null;

  return defaultValue?.content ?? "";
}

/**
 * Update AI config.
 * When AI enabled state changes, broadcasts policyUpdated so all users
 * get updated isAIEnabled (affects recipe convert button visibility).
 */
const updateAIConfig = adminProcedure.input(AIConfigSchema).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id, enabled: input.enabled }, "Updating AI config");

  // Get current AI config to check if enabled state changed
  const currentConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG);
  const enabledChanged = currentConfig?.enabled !== input.enabled;

  await setConfig(ServerConfigKeys.AI_CONFIG, input, ctx.user.id, true);

  // Broadcast permission policy update to all users if AI enabled state changed
  // This allows UI to show/hide recipe convert button
  if (enabledChanged) {
    log.info({ enabled: input.enabled }, "AI enabled state changed, broadcasting policy update");
    const recipePolicy = await getRecipePermissionPolicy();

    permissionsEmitter.broadcast("policyUpdated", { recipePolicy });
  }

  return { success: true };
});

/**
 * Update video config.
 */
const updateVideoConfig = adminProcedure
  .input(VideoConfigSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, enabled: input.enabled }, "Updating video config");

    // VideoConfig contains transcription API key, so mark as sensitive
    await setConfig(ServerConfigKeys.VIDEO_CONFIG, input, ctx.user.id, true);

    return { success: true };
  });

/**
 * Test AI endpoint connection.
 * This is a synchronous test that returns a result (not fire-and-forget).
 */
const testAIEndpoint = adminProcedure
  .input(
    z.object({
      provider: AIConfigSchema.shape.provider,
      endpoint: z.string().url().optional(),
      apiKey: z.string().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, provider: input.provider }, "Testing AI endpoint");

    return await testAIEndpointFn(input);
  });

/**
 * Get prompt content from database.
 * Prompts are seeded on startup, so this always reads from DB.
 * Returns both current content and default content for comparison.
 */
const getPrompt = adminProcedure
  .input(z.object({ name: PromptNameSchema }))
  .query(async ({ input, ctx }) => {
    log.debug({ userId: ctx.user.id, promptName: input.name }, "Getting prompt");

    const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
    const stored = await getConfig<PromptConfig>(configKey);
    const defaultContent = getDefaultPromptContent(input.name);

    const content = stored?.content ?? defaultContent;
    const isCustom = content !== defaultContent;

    return {
      name: input.name,
      content,
      isCustom,
      defaultContent,
    };
  });

/**
 * Update/override a prompt
 */
const updatePrompt = adminProcedure
  .input(
    z.object({
      name: PromptNameSchema,
      content: z.string().min(1, "Prompt content is required"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    log.info(
      { userId: ctx.user.id, promptName: input.name, contentLength: input.content.length },
      "Updating prompt"
    );

    const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];

    await setConfig(configKey, { content: input.content }, ctx.user.id, false);

    return { success: true };
  });

/**
 * Reset prompt to default by re-seeding from the txt file
 */
const resetPrompt = adminProcedure
  .input(z.object({ name: PromptNameSchema }))
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, promptName: input.name }, "Resetting prompt to default");

    const configKey = PROMPT_NAME_TO_CONFIG_KEY[input.name];
    const defaultContent = getDefaultPromptContent(input.name);

    await setConfig(configKey, { content: defaultContent }, ctx.user.id, false);

    return { success: true };
  });

/**
 * List all available prompts with their custom status
 */
const listPrompts = adminProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Listing prompts");

  const prompts: PromptName[] = ["recipe-extraction", "unit-conversion"];
  const results = await Promise.all(
    prompts.map(async (name) => {
      const configKey = PROMPT_NAME_TO_CONFIG_KEY[name];
      const stored = await getConfig<PromptConfig>(configKey);
      const defaultContent = getDefaultPromptContent(name);

      return {
        name,
        isCustom: stored?.content !== defaultContent,
      };
    })
  );

  return results;
});

export const promptsProcedures = router({
  getPrompt,
  updatePrompt,
  resetPrompt,
  listPrompts,
});

export const aiVideoProcedures = router({
  updateAIConfig,
  updateVideoConfig,
  testAIEndpoint,
});
