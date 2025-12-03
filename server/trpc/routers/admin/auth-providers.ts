import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, deleteConfig, configExists } from "@/server/db/repositories/server-config";
import {
  testOIDCProvider,
  testGitHubProvider,
  testGoogleProvider,
} from "@/server/auth/connection-tests";
import {
  ServerConfigKeys,
  type ServerConfigKey,
  AuthProviderOIDCSchema,
  AuthProviderOIDCInputSchema,
  AuthProviderGitHubSchema,
  AuthProviderGitHubInputSchema,
  AuthProviderGoogleSchema,
  AuthProviderGoogleInputSchema,
} from "@/server/db/zodSchemas/server-config";

/**
 * Update OIDC auth provider config.
 */
const updateOIDC = adminProcedure
  .input(AuthProviderOIDCInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating OIDC auth provider");

    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_OIDC,
      { ...input, isOverridden: true },
      ctx.user.id,
      true
    );

    return { success: true };
  });

/**
 * Update GitHub auth provider config.
 */
const updateGitHub = adminProcedure
  .input(AuthProviderGitHubInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating GitHub auth provider");

    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_GITHUB,
      { ...input, isOverridden: true },
      ctx.user.id,
      true
    );

    return { success: true };
  });

/**
 * Update Google auth provider config.
 */
const updateGoogle = adminProcedure
  .input(AuthProviderGoogleInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id }, "Updating Google auth provider");

    await setConfig(
      ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
      { ...input, isOverridden: true },
      ctx.user.id,
      true
    );

    return { success: true };
  });

/**
 * Delete an auth provider.
 */
const deleteProvider = adminProcedure
  .input(z.enum(["oidc", "github", "google"]))
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, provider: input }, "Deleting auth provider");

    const keyMap: Record<string, ServerConfigKey> = {
      oidc: ServerConfigKeys.AUTH_PROVIDER_OIDC,
      github: ServerConfigKeys.AUTH_PROVIDER_GITHUB,
      google: ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
    };
    const key = keyMap[input];

    // Check if this is the last configured auth provider
    const otherProviderKeys = Object.entries(keyMap)
      .filter(([k]) => k !== input)
      .map(([, v]) => v);

    const hasOtherProvider = await Promise.all(otherProviderKeys.map((k) => configExists(k))).then(
      (results) => results.some(Boolean)
    );

    if (!hasOtherProvider) {
      return {
        success: false,
        error:
          "Cannot delete the last authentication provider. At least one provider must remain configured.",
      };
    }

    await deleteConfig(key);

    return { success: true };
  });

/**
 * Test an auth provider connection.
 * This is a synchronous test that returns a result (not fire-and-forget).
 */
const testProvider = adminProcedure
  .input(
    z.object({
      type: z.enum(["oidc", "github", "google"]),
      config: z.record(z.string(), z.unknown()),
    })
  )
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, provider: input.type }, "Testing auth provider");

    switch (input.type) {
      case "oidc": {
        const result = AuthProviderOIDCSchema.safeParse(input.config);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return await testOIDCProvider(result.data);
      }
      case "github": {
        const result = AuthProviderGitHubSchema.safeParse(input.config);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return await testGitHubProvider(result.data);
      }
      case "google": {
        const result = AuthProviderGoogleSchema.safeParse(input.config);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return await testGoogleProvider(result.data);
      }
      default:
        return { success: false, error: `Unknown provider type: ${input.type}` };
    }
  });

export const authProvidersProcedures = router({
  updateOIDC,
  updateGitHub,
  updateGoogle,
  deleteProvider,
  testProvider,
});
