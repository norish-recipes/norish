import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";
import { permissionsEmitter } from "../permissions/emitter";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, getConfig } from "@/server/db/repositories/server-config";
import { getRecipesWithoutCategories } from "@/server/db/repositories/recipes";
import { testAIEndpoint as testAIEndpointFn } from "@/server/auth/connection-tests";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import { listModels, listTranscriptionModels } from "@/server/ai/providers";
import { getQueues } from "@/server/queue/registry";
import { addAutoCategorizationJob } from "@/server/queue/auto-categorization/producer";
import {
  ServerConfigKeys,
  AIConfigSchema,
  VideoConfigSchema,
  TranscriptionProviderSchema,
  type AIConfig,
  type VideoConfig,
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

/**
 * List available models for a given AI provider.
 * Used by the admin UI to populate model dropdowns.
 */
const listAvailableModels = adminProcedure
  .input(
    z.object({
      provider: AIConfigSchema.shape.provider,
      endpoint: z.string().optional(),
      apiKey: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    log.debug({ userId: ctx.user.id, provider: input.provider }, "Listing available AI models");

    let apiKey = input.apiKey;

    // If no API key provided, try to get from stored config if provider matches
    if (!apiKey) {
      const storedConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG, true);

      if (storedConfig?.provider === input.provider) {
        apiKey = storedConfig.apiKey;
      }
    }

    const models = await listModels(input.provider, {
      endpoint: input.endpoint,
      apiKey,
    });

    return { models };
  });

/**
 * List available transcription models for a given provider.
 * Used by the admin UI to populate transcription model dropdowns.
 */
const listAvailableTranscriptionModels = adminProcedure
  .input(
    z.object({
      provider: TranscriptionProviderSchema,
      endpoint: z.string().optional(),
      apiKey: z.string().optional(),
    })
  )
  .query(async ({ input, ctx }) => {
    log.debug(
      { userId: ctx.user.id, provider: input.provider },
      "Listing available transcription models"
    );

    let apiKey = input.apiKey;

    // If no API key provided, try to get from stored configs
    if (!apiKey) {
      // First try video config, then fall back to AI config
      const videoConfig = await getConfig<VideoConfig>(ServerConfigKeys.VIDEO_CONFIG, true);

      apiKey = videoConfig?.transcriptionApiKey;

      if (!apiKey) {
        const aiConfig = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG, true);

        apiKey = aiConfig?.apiKey;
      }
    }

    const models = await listTranscriptionModels(input.provider, {
      endpoint: input.endpoint,
      apiKey,
    });

    return { models };
  });

const categorizeAllRecipes = adminProcedure.mutation(async ({ ctx }) => {
  log.info({ userId: ctx.user.id }, "Bulk categorization requested");

  const uncategorized = await getRecipesWithoutCategories();

  if (uncategorized.length === 0) {
    log.info("No uncategorized recipes found");

    return { queued: 0 };
  }

  const queues = getQueues();

  for (const recipe of uncategorized) {
    await addAutoCategorizationJob(queues.autoCategorization, {
      recipeId: recipe.id,
      userId: ctx.user.id,
      householdKey: ctx.household?.id ?? "",
    });
  }

  log.info({ count: uncategorized.length }, "Bulk categorization jobs queued");

  return { queued: uncategorized.length };
});

export const aiConfigProcedures = router({
  updateAIConfig,
  updateVideoConfig,
  testAIEndpoint,
  listAvailableModels,
  listAvailableTranscriptionModels,
  categorizeAllRecipes,
});
