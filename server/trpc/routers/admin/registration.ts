import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, configExists } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

/**
 * Update registration enabled setting.
 */
const updateRegistration = adminProcedure.input(z.boolean()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id, enabled: input }, "Updating registration setting");

  await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, input, ctx.user.id, false);

  return { success: true };
});

/**
 * Update password authentication enabled setting.
 */
const updatePasswordAuth = adminProcedure.input(z.boolean()).mutation(async ({ input, ctx }) => {
  log.info({ userId: ctx.user.id, enabled: input }, "Updating password auth setting");

  // If disabling password auth, check if any OAuth provider is configured
  if (input === false) {
    const oauthProviderKeys = [
      ServerConfigKeys.AUTH_PROVIDER_OIDC,
      ServerConfigKeys.AUTH_PROVIDER_GITHUB,
      ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
    ];

    const hasOAuthProvider = await Promise.all(oauthProviderKeys.map((k) => configExists(k))).then(
      (results) => results.some(Boolean)
    );

    if (!hasOAuthProvider) {
      log.info(
        { userId: ctx.user.id, provider: input },
        "Cannot delete the last authentication method"
      );

      return {
        success: false,
        error: "Cannot delete the last authentication method.",
      };
    }
  }

  await setConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED, input, ctx.user.id, false);

  return { success: true };
});

export const registrationProcedures = router({
  updateRegistration,
  updatePasswordAuth,
});
