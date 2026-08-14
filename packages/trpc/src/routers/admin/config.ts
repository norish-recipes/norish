import { z } from "zod";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getAllConfigs, getConfigSecret } from "@norish/db/repositories/server-config";
import { getEffectivePrompts } from "@norish/shared-server/ai/prompts/loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Get all server configs (secrets masked).
 * Only accessible by server admins.
 */
const getAllConfigsProcedure = adminProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting all server configs");

  const configs = await getAllConfigs(false);

  // The prompts row stores only administrator overrides; the admin surface
  // shows the prompts actually in use, so merge the shipped defaults in.
  const { values, overriddenFields } = await getEffectivePrompts();

  configs[ServerConfigKeys.PROMPTS] = { ...values, isOverridden: overriddenFields.length > 0 };

  return configs;
});

/**
 * Get a specific secret field from a config.
 * Only accessible by server admins.
 */
const getSecretField = adminProcedure
  .input(
    z.object({
      key: z.enum(ServerConfigKeys),
      field: z.string().min(1),
    })
  )
  .query(async ({ input, ctx }) => {
    log.debug({ userId: ctx.user.id, key: input.key, field: input.field }, "Getting secret field");

    const secret = await getConfigSecret(input.key as ServerConfigKey, input.field);

    if (secret === null) {
      return { value: null };
    }

    return { value: secret };
  });

export const adminConfigProcedures = router({
  getAllConfigs: getAllConfigsProcedure,
  getSecretField,
});
