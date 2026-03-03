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

const MESSAGE_LOADERS: Record<string, Partial<Record<MessageSection, MessageLoader>>> = {
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
};

export async function loadLocaleMessages(locale: string): Promise<Record<string, unknown>> {
  const messages: Record<string, unknown> = {};
  const localeLoaders = MESSAGE_LOADERS[locale] ?? {};

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
