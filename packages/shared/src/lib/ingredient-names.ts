/**
 * An Ingredient's name in the viewer's language (ADR-0038). Surfaces that show
 * an Ingredient rather than a line — the Ingredients page, the Pantry — show
 * the spelling the catalogue has in the viewer's language, falling back to
 * the Ingredient's own name. Recipe and grocery lines always show their text
 * as written, and never come here.
 *
 * The server sends each Ingredient's best spelling per language it has one
 * in (`LocaleNames`), because the viewer's language lives in the browser; the
 * browser picks. Names are keyed by the catalogue's language codes (Open Food
 * Facts' `nl`, `de`, `nb`), not by Norish's locales (`de-formal`, `no`).
 */

/** An Ingredient's best spelling in each catalogue language it has one in. */
export type LocaleNames = Record<string, string>;

/**
 * The catalogue languages each Norish locale reads names in, most specific
 * first. A locale missing here reads its base language.
 */
const LANGUAGES_BY_LOCALE: Record<string, readonly string[]> = {
  "de-formal": ["de"],
  "de-informal": ["de"],
  "pt-BR": ["pt"],
  no: ["nb", "no", "nn"],
};

/** Every catalogue language some Norish locale reads: the only ones worth sending. */
export const CATALOGUE_LANGUAGES: readonly string[] = [
  "en",
  "nl",
  "de",
  "fr",
  "es",
  "ru",
  "ko",
  "nb",
  "no",
  "nn",
  "pl",
  "da",
  "it",
  "pt",
  "bg",
  "fi",
  "uk",
];

export function catalogueLanguagesFor(locale: string): readonly string[] {
  return LANGUAGES_BY_LOCALE[locale] ?? [locale.split("-")[0]!.toLowerCase()];
}

/** The name to show for an Ingredient to a viewer reading `locale`. */
export function ingredientDisplayName(
  ingredient: { name: string; localeNames?: LocaleNames | null },
  locale: string
): string {
  for (const language of catalogueLanguagesFor(locale)) {
    const name = ingredient.localeNames?.[language];

    if (name) return name;
  }

  return ingredient.name;
}

/**
 * Each language's best spelling among an Ingredient's aliases: the
 * catalogue's own spellings before a person's, then the shortest (the
 * taxonomy lists the plain word before its plurals and variants), then the
 * first in alphabetical order, so the choice never depends on the order the
 * rows came back in.
 */
export function chooseLocaleNames(
  aliases: ReadonlyArray<{ text: string; locale: string | null; seeded: boolean }>
): LocaleNames {
  const best = new Map<string, { text: string; seeded: boolean }>();

  for (const alias of aliases) {
    if (!alias.locale || !CATALOGUE_LANGUAGES.includes(alias.locale)) continue;

    const held = best.get(alias.locale);

    if (!held || beats(alias, held)) best.set(alias.locale, alias);
  }

  return Object.fromEntries([...best].map(([locale, alias]) => [locale, alias.text]));
}

function beats(
  candidate: { text: string; seeded: boolean },
  held: { text: string; seeded: boolean }
): boolean {
  if (candidate.seeded !== held.seeded) return candidate.seeded;
  if (candidate.text.length !== held.text.length) return candidate.text.length < held.text.length;

  return candidate.text.localeCompare(held.text) < 0;
}
