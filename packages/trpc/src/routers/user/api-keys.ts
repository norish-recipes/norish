import { createApiKey, deleteApiKey, disableApiKey, enableApiKey } from "@norish/db";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { CreateApiKeyInputSchema, DeleteApiKeyInputSchema, ToggleApiKeyInputSchema } from "./types";

/**
 * Create a new API key
 */
const create = authedProcedure.input(CreateApiKeyInputSchema).mutation(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id }, "Creating API key");

  const { key, metadata } = await createApiKey(ctx.user.id, input.name);

  log.info({ userId: ctx.user.id, keyId: metadata.id }, "API key created");

  return {
    success: true,
    key, // This is only returned once, user must save it
    metadata: {
      id: metadata.id,
      name: metadata.name,
      start: metadata.start,
      createdAt: metadata.createdAt,
      expiresAt: metadata.expiresAt,
      enabled: metadata.enabled,
    },
  };
});

/**
 * Delete an API key
 */
const remove = authedProcedure.input(DeleteApiKeyInputSchema).mutation(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, keyId: input.keyId }, "Deleting API key");

  await deleteApiKey(input.keyId, ctx.user.id);

  log.info({ userId: ctx.user.id, keyId: input.keyId }, "API key deleted");

  return { success: true };
});

/**
 * Toggle API key enabled/disabled
 */
const toggle = authedProcedure.input(ToggleApiKeyInputSchema).mutation(async ({ ctx, input }) => {
  log.debug(
    { userId: ctx.user.id, keyId: input.keyId, enabled: input.enabled },
    "Toggling API key"
  );

  if (input.enabled) {
    await enableApiKey(input.keyId, ctx.user.id);
  } else {
    await disableApiKey(input.keyId, ctx.user.id);
  }

  log.info({ userId: ctx.user.id, keyId: input.keyId, enabled: input.enabled }, "API key toggled");

  return { success: true };
});

export const apiKeysProcedures = router({
  create,
  delete: remove,
  toggle,
});
