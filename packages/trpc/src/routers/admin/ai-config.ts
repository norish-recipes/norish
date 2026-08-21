import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { AIConfig, VideoConfig } from "@norish/config/zod/server-config";
import { testAIEndpoint as testAIEndpointFn } from "@norish/auth/connection-tests";
import {
  AIConfigInputSchema,
  AIConfigSchema,
  ServerConfigKeys,
  TranscriptionProviderSchema,
  VideoConfigSchema,
} from "@norish/config/zod/server-config";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { enrollEnrichmentForAllRecipes } from "@norish/queue";
import {
  listModels,
  listTranscriptionModels,
  ModelListingError,
} from "@norish/shared-server/ai/providers/listing";
import {
  getRecipePermissionPolicy,
  isAIEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";
import { permissionsEmitter } from "../permissions/emitter";

type ListedModel = {
  id: string;
  name: string;
  supportsVision?: boolean;
};

/** Why a list came back empty, in parts the UI can phrase in its own language. */
type ListingRefusal = {
  provider: string;
  status?: number;
  statusText?: string;
};

/**
 * Run a listing and report a refusal rather than letting it read as "no models".
 *
 * A provider that rejects the key answers with nothing, which is exactly what a
 * provider that was never configured answers with. The dropdown cannot tell an
 * administrator which of the two happened unless the reason travels with the
 * (empty) list, so it does.
 */
async function listOrExplain(
  provider: string,
  list: () => Promise<{ id: string; name: string; supportsVision?: boolean }[]>
): Promise<{ models: ListedModel[]; refusal?: ListingRefusal }> {
  try {
    const listed = await list();

    return {
      models: listed.map((model) => ({
        id: model.id,
        name: model.name,
        supportsVision: model.supportsVision,
      })),
    };
  } catch (cause) {
    if (!(cause instanceof ModelListingError)) {
      throw cause;
    }

    log.warn({ err: cause, provider }, "Model listing refused by provider");

    return {
      models: [],
      refusal: {
        provider: cause.provider,
        status: cause.status,
        statusText: cause.statusText,
      },
    };
  }
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
      provider: AIConfigInputSchema.shape.provider,
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
      provider: AIConfigInputSchema.shape.provider,
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

    return listOrExplain(input.provider, () =>
      listModels(input.provider, {
        endpoint: input.endpoint,
        apiKey,
      })
    );
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

    return listOrExplain(input.provider, () =>
      listTranscriptionModels(input.provider, {
        endpoint: input.endpoint,
        apiKey,
      })
    );
  });

/**
 * Enroll every enabled enrichment kind for every recipe on the server.
 *
 * Deliberately the automatic origin: the automatic switches decide which kinds
 * run, and by default Supplied Recipe Data keeps winning, so the sweep fills
 * gaps without replacing anything a person or an import source provided.
 *
 * `replaceExisting` is the destructive variant, and it is a per-request choice
 * rather than stored configuration on purpose: a stored switch would also
 * govern the automatic enrollment every newly imported recipe triggers, which
 * would turn "enrich what is missing" into "overwrite what the source said".
 */
const enrichAllRecipes = adminProcedure
  .input(z.object({ replaceExisting: z.boolean().default(false) }).default({}))
  .mutation(async ({ input, ctx }) => {
    log.info(
      { userId: ctx.user.id, replaceExisting: input.replaceExisting },
      "Bulk enrichment requested"
    );

    if (!(await isAIEnabled())) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "AI is disabled on this server. Enable AI before running enrichment.",
      });
    }

    const result = await enrollEnrichmentForAllRecipes(
      {
        userId: ctx.user.id,
        householdKey: ctx.household?.id ?? "",
      },
      { replaceExisting: input.replaceExisting }
    );

    log.info({ ...result, replaceExisting: input.replaceExisting }, "Bulk enrichment jobs queued");

    return result;
  });

export const aiConfigProcedures = router({
  updateAIConfig,
  updateVideoConfig,
  testAIEndpoint,
  listAvailableModels,
  listAvailableTranscriptionModels,
  enrichAllRecipes,
});
