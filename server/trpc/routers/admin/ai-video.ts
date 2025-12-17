import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";
import { permissionsEmitter } from "../permissions/emitter";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, getConfig } from "@/server/db/repositories/server-config";
import { testAIEndpoint as testAIEndpointFn } from "@/server/auth/connection-tests";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import {
  ServerConfigKeys,
  AIConfigSchema,
  VideoConfigSchema,
  type AIConfig,
} from "@/server/db/zodSchemas/server-config";

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

    let apiKey = input.apiKey;
    if (!apiKey) {
      const storedConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG, true);
      apiKey = storedConfig?.apiKey;
    }

    return await testAIEndpointFn({ ...input, apiKey });
  });

export const aiVideoProcedures = router({
  updateAIConfig,
  updateVideoConfig,
  testAIEndpoint,
});
