import { z } from "zod";

import type { I18nLocaleConfig } from "@norish/config/zod/server-config";
import { I18nLocaleConfigSchema, ServerConfigKeys } from "@norish/config/zod/server-config";
import { configExists, getConfig, setConfig } from "@norish/db/repositories/server-config";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

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
        { userId: ctx.user.id, enabled: input },
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

/**
 * Input schema for updating locale config
 */
const UpdateLocaleConfigInputSchema = z.object({
  defaultLocale: z.string(),
  enabledLocales: z.array(z.string()).min(1, "At least one locale must be enabled"),
});

/**
 * Update locale configuration (enabled locales and default locale).
 */
const updateLocaleConfig = adminProcedure
  .input(UpdateLocaleConfigInputSchema)
  .mutation(async ({ input, ctx }) => {
    log.info(
      {
        userId: ctx.user.id,
        defaultLocale: input.defaultLocale,
        enabledCount: input.enabledLocales.length,
      },
      "Updating locale config"
    );

    const currentConfig = await getConfig<I18nLocaleConfig>(ServerConfigKeys.LOCALE_CONFIG);

    if (!currentConfig) {
      return {
        success: false,
        error: "Locale configuration not found. Please restart the server.",
      };
    }

    const enabledLocales = new Set(input.enabledLocales);
    const validLocales = Object.keys(currentConfig.locales);

    // Default locale must be enabled
    if (!enabledLocales.has(input.defaultLocale)) {
      return {
        success: false,
        error: "Default locale must be one of the enabled locales.",
      };
    }

    // All enabled locales must exist
    const invalidLocales = [...enabledLocales].filter((code) => !validLocales.includes(code));

    if (invalidLocales.length > 0) {
      return {
        success: false,
        error: `Invalid locale codes: ${invalidLocales.join(", ")}`,
      };
    }

    const newConfig: I18nLocaleConfig = {
      defaultLocale: input.defaultLocale,
      locales: Object.fromEntries(
        Object.entries(currentConfig.locales).map(([code, entry]) => [
          code,
          {
            name: entry.name,
            enabled: enabledLocales.has(code),
          },
        ])
      ),
    };

    const validation = I18nLocaleConfigSchema.safeParse(newConfig);

    if (!validation.success) {
      return {
        success: false,
        error: "Invalid locale configuration format.",
      };
    }

    await setConfig(ServerConfigKeys.LOCALE_CONFIG, newConfig, ctx.user.id, false);

    return { success: true };
  });

export const generalProcedures = router({
  updateRegistration,
  updatePasswordAuth,
  updateLocaleConfig,
});
