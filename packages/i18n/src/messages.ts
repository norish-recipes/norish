import type { LocaleCatalogCode } from "./locales";

export const I18N_MESSAGE_SECTIONS = [
  "common",
  "recipes",
  "groceries",
  "calendar",
  "settings",
  "navbar",
  "auth",
] as const;

type MessageSection = (typeof I18N_MESSAGE_SECTIONS)[number];
type MessageLoader = () => Promise<{ default: Record<string, unknown> }>;

const MESSAGE_LOADERS: Record<LocaleCatalogCode, Partial<Record<MessageSection, MessageLoader>>> = {
  en: {
    common: () => import("./messages/en/common.json"),
    recipes: () => import("./messages/en/recipes.json"),
    groceries: () => import("./messages/en/groceries.json"),
    calendar: () => import("./messages/en/calendar.json"),
    settings: () => import("./messages/en/settings.json"),
    navbar: () => import("./messages/en/navbar.json"),
    auth: () => import("./messages/en/auth.json"),
  },
  fr: {
    common: () => import("./messages/fr/common.json"),
    recipes: () => import("./messages/fr/recipes.json"),
    groceries: () => import("./messages/fr/groceries.json"),
    calendar: () => import("./messages/fr/calendar.json"),
    settings: () => import("./messages/fr/settings.json"),
    navbar: () => import("./messages/fr/navbar.json"),
    auth: () => import("./messages/fr/auth.json"),
  },
  es: {
    common: () => import("./messages/es/common.json"),
    recipes: () => import("./messages/es/recipes.json"),
    groceries: () => import("./messages/es/groceries.json"),
    calendar: () => import("./messages/es/calendar.json"),
    settings: () => import("./messages/es/settings.json"),
    navbar: () => import("./messages/es/navbar.json"),
    auth: () => import("./messages/es/auth.json"),
  },
  "de-formal": {
    common: () => import("./messages/de-formal/common.json"),
    recipes: () => import("./messages/de-formal/recipes.json"),
    groceries: () => import("./messages/de-formal/groceries.json"),
    calendar: () => import("./messages/de-formal/calendar.json"),
    settings: () => import("./messages/de-formal/settings.json"),
    navbar: () => import("./messages/de-formal/navbar.json"),
    auth: () => import("./messages/de-formal/auth.json"),
  },
  "de-informal": {
    common: () => import("./messages/de-informal/common.json"),
    recipes: () => import("./messages/de-informal/recipes.json"),
    groceries: () => import("./messages/de-informal/groceries.json"),
    calendar: () => import("./messages/de-informal/calendar.json"),
    settings: () => import("./messages/de-informal/settings.json"),
    navbar: () => import("./messages/de-informal/navbar.json"),
    auth: () => import("./messages/de-informal/auth.json"),
  },
  nl: {
    common: () => import("./messages/nl/common.json"),
    recipes: () => import("./messages/nl/recipes.json"),
    groceries: () => import("./messages/nl/groceries.json"),
    calendar: () => import("./messages/nl/calendar.json"),
    settings: () => import("./messages/nl/settings.json"),
    navbar: () => import("./messages/nl/navbar.json"),
    auth: () => import("./messages/nl/auth.json"),
  },
  ko: {
    common: () => import("./messages/ko/common.json"),
    recipes: () => import("./messages/ko/recipes.json"),
    groceries: () => import("./messages/ko/groceries.json"),
    calendar: () => import("./messages/ko/calendar.json"),
    settings: () => import("./messages/ko/settings.json"),
    navbar: () => import("./messages/ko/navbar.json"),
    auth: () => import("./messages/ko/auth.json"),
  },
  ru: {
    common: () => import("./messages/ru/common.json"),
    recipes: () => import("./messages/ru/recipes.json"),
    groceries: () => import("./messages/ru/groceries.json"),
    calendar: () => import("./messages/ru/calendar.json"),
    settings: () => import("./messages/ru/settings.json"),
    navbar: () => import("./messages/ru/navbar.json"),
    auth: () => import("./messages/ru/auth.json"),
  },
  pl: {
    common: () => import("./messages/pl/common.json"),
    recipes: () => import("./messages/pl/recipes.json"),
    groceries: () => import("./messages/pl/groceries.json"),
    calendar: () => import("./messages/pl/calendar.json"),
    settings: () => import("./messages/pl/settings.json"),
    navbar: () => import("./messages/pl/navbar.json"),
    auth: () => import("./messages/pl/auth.json"),
  },
  da: {
    common: () => import("./messages/da/common.json"),
    recipes: () => import("./messages/da/recipes.json"),
    groceries: () => import("./messages/da/groceries.json"),
    calendar: () => import("./messages/da/calendar.json"),
    settings: () => import("./messages/da/settings.json"),
    navbar: () => import("./messages/da/navbar.json"),
    auth: () => import("./messages/da/auth.json"),
  },
  it: {
    common: () => import("./messages/it/common.json"),
    recipes: () => import("./messages/it/recipes.json"),
    groceries: () => import("./messages/it/groceries.json"),
    calendar: () => import("./messages/it/calendar.json"),
    settings: () => import("./messages/it/settings.json"),
    navbar: () => import("./messages/it/navbar.json"),
    auth: () => import("./messages/it/auth.json"),
  },
};

export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  const messages: Record<string, unknown> = {};
  const localeLoaders = MESSAGE_LOADERS[locale as LocaleCatalogCode] ?? {};

  for (const section of I18N_MESSAGE_SECTIONS) {
    const loadSection = localeLoaders[section];

    if (!loadSection) {
      continue;
    }

    try {
      const sectionMessages = (await loadSection()).default;

      messages[section] = sectionMessages;
    } catch {
      continue;
    }
  }

  return messages;
}
