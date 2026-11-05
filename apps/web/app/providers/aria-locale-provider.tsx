"use client";

import { I18nProvider } from "@heroui/react";
import { useLocale } from "next-intl";

/**
 * HeroUI's components take their locale, and with it their direction, from
 * React Aria, which falls back to the browser's language. This hands them the
 * app's own, so an Arabic page in an English browser still opens its menus,
 * popovers and sliders right to left, and an English page in an Arabic browser
 * keeps them left to right.
 */
export function AriaLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
