export const LOCALE_CATALOG = {
  en: { name: "English" },
  nl: { name: "Nederlands" },
  "de-formal": { name: "Deutsch (Sie)" },
  "de-informal": { name: "Deutsch (Du)" },
  fr: { name: "Francais" },
  es: { name: "Espanol" },
  ru: { name: "Russkii" },
  ko: { name: "Hangugeo" },
  pl: { name: "Polski" },
  da: { name: "Dansk" },
  it: { name: "Italiano" },
} as const;

export type LocaleCatalogCode = keyof typeof LOCALE_CATALOG;

export type LocaleCatalogEntry = {
  code: LocaleCatalogCode;
  name: string;
};

export const BUNDLED_LOCALES: ReadonlyArray<LocaleCatalogEntry> = Object.entries(
  LOCALE_CATALOG
).map(([code, entry]) => ({
  code: code as LocaleCatalogCode,
  name: entry.name,
}));

export function getBundledLocales(): LocaleCatalogEntry[] {
  return BUNDLED_LOCALES.map((locale) => ({ ...locale }));
}
