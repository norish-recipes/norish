import { z } from "zod";

import { router } from "../../trpc";
import { adminProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { setConfig, configExists, getConfig } from "@/server/db/repositories/server-config";
import {
  ServerConfigKeys,
  I18nLocaleConfigSchema,
  ThemeConfigSchema,
  type I18nLocaleConfig,
  type ThemeConfig,
} from "@/server/db/zodSchemas/server-config";
import { safeFetch, validateUrlForSSRF } from "@/server/lib/ssrf-protection";

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

/**
 * Update theme configuration (external CSS URL).
 */
const updateThemeConfig = adminProcedure
  .input(ThemeConfigSchema)
  .mutation(async ({ input, ctx }) => {
    log.info({ userId: ctx.user.id, cssUrl: input.cssUrl }, "Updating theme config");

    await setConfig(ServerConfigKeys.THEME_CONFIG, input, ctx.user.id, false);

    return { success: true };
  });

/**
 * Test theme CSS by fetching it and validating it's valid CSS.
 * Includes SSRF protection to prevent attacks on internal networks.
 */
const testThemeCss = adminProcedure.input(z.string().url()).mutation(async ({ input: url }) => {
  log.info({ url }, "Testing theme CSS");

  // Parse and validate URL protocol
  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch (error) {
    return {
      success: false,
      error: "Invalid URL format",
    };
  }

  // Check if URL is localhost (skip SSRF checks for local development)
  const isLocalhost =
    urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1" || urlObj.hostname === "::1";

  if (isLocalhost) {
    // Localhost URLs: only validate HTTPS or HTTP
    if (urlObj.protocol !== "https:" && urlObj.protocol !== "http:") {
      return {
        success: false,
        error: "Localhost URLs must use HTTP or HTTPS protocol",
      };
    }
  } else {
    // External URLs: enforce HTTPS
    if (urlObj.protocol !== "https:") {
      return {
        success: false,
        error: "External URLs must use HTTPS protocol",
      };
    }

    // Validate against SSRF attacks
    const ssrfValidation = await validateUrlForSSRF(url);
    if (!ssrfValidation.valid) {
      log.warn({ url, error: ssrfValidation.error }, "Theme URL failed SSRF validation");
      return {
        success: false,
        error: ssrfValidation.error || "URL validation failed for security reasons",
      };
    }
  }

  // Fetch the CSS with protection
  try {
    const response = isLocalhost
      ? await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Norish-ThemeValidator/1.0",
          },
        })
      : await safeFetch(
          url,
          {
            method: "GET",
            headers: {
              "User-Agent": "Norish-ThemeValidator/1.0",
            },
          },
          10000 // 10 second timeout
        );

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch CSS: HTTP ${response.status} ${response.statusText}`,
      };
    }

    const contentType = response.headers.get("content-type");
    const isValidCss = contentType?.includes("text/css") || contentType?.includes("text/plain");

    if (!isValidCss) {
      log.warn({ url, contentType }, "CSS URL returned invalid content type");
      return {
        success: false,
        error: `Invalid content type: Expected text/css but got ${contentType || "none"}`,
      };
    }

    const cssText = await response.text();

    // Basic CSS syntax validation - check if it looks like CSS
    if (cssText.trim().length === 0) {
      return {
        success: false,
        error: "CSS file is empty",
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.warn({ url, error: errorMessage }, "Theme CSS test failed");

    return {
      success: false,
      error: `Could not fetch CSS: ${errorMessage}`,
    };
  }
});

export const generalProcedures = router({
  updateRegistration,
  updatePasswordAuth,
  updateLocaleConfig,
  updateThemeConfig,
  testThemeCss,
});
