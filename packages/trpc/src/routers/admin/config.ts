import { z } from "zod";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getAllConfigs, getConfigSecret } from "@norish/db/repositories/server-config";
import { getUserServerRole } from "@norish/db/repositories/users";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure, authedProcedure } from "../../middleware";
import { router } from "../../trpc";

/**
 * Get all server configs (secrets masked).
 * Only accessible by server admins.
 */
const getAllConfigsProcedure = adminProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting all server configs");

  const configs = await getAllConfigs(false);

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

/**
 * Get user's admin role.
 * Accessible by any authenticated user (used to determine if admin tab should show).
 */
const getUserRoleProcedure = authedProcedure.query(async ({ ctx }) => {
  const role = await getUserServerRole(ctx.user.id);

  return role;
});

export const adminConfigProcedures = router({
  getAllConfigs: getAllConfigsProcedure,
  getSecretField,
  getUserRole: getUserRoleProcedure,
});
