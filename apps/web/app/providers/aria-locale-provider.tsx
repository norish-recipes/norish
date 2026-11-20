"use client";

import { I18nProvider } from "@heroui/react";
import { useLocale } from "next-intl";

import { getLocaleDirection } from "@norish/i18n/config";

/** React Aria parses numbers and dates in the browser's locale; only a right-to-left page
 * hands it the app's locale, so menus and sliders run RTL. */
export function AriaLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();

  if (getLocaleDirection(locale) === "ltr") return children;

  return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
