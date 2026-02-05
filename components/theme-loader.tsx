"use client";

import { useEffect } from "react";
import { useAdminConfigsQuery } from "@/hooks/admin/use-admin-query";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";
import { loadThemeCSS } from "@/lib/theme-loader";

/**
 * ThemeLoader
 * Loads custom theme CSS on app startup if configured
 */
export function ThemeLoader() {
  const { configs } = useAdminConfigsQuery();

  useEffect(() => {
    const themeConfig = configs[ServerConfigKeys.THEME_CONFIG] as
      | { cssUrl?: string | null }
      | undefined;

    if (themeConfig?.cssUrl) {
      loadThemeCSS(themeConfig.cssUrl);
    } else {
      // Clear any existing custom theme if config is removed
      const existing = document.getElementById("norish-custom-theme");
      if (existing) {
        existing.remove();
      }
    }
  }, [configs]);

  return null;
}
