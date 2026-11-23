import { changesAllergies } from "@norish/shared-react/reader";

import type { DraftWrite } from "./draft-rules";

const SUGGESTION_LIMIT = 8;
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The allergies: the whole draft, sent only when the server would store something else. */
export const ALLERGY_DRAFT: DraftWrite<string[]> = {
  sent: (draft) => draft,
  changes: changesAllergies,
};

/** Adds a typed name to the shown list, unless it is blank or already there (any case). */
export function withAllergy(shown: string[], typed: string) {
  const name = typed.trim();

  return name && !shown.some((has) => sameName(has, name)) ? [...shown, name] : null;
}

export const withoutAllergy = (shown: string[], name: string) =>
  shown.filter((has) => !sameName(has, name));

/** Known tags holding what is typed, a start-of-name match first, none already chosen. */
export function allergySuggestions(known: readonly string[], typed: string, shown: string[]) {
  const needle = typed.trim().toLowerCase();

  if (!needle) return [];

  const fits = known.filter(
    (tag) => tag.toLowerCase().includes(needle) && !shown.some((has) => sameName(has, tag))
  );
  const rank = (tag: string) => (tag.toLowerCase().startsWith(needle) ? 0 : 1);

  return fits.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, SUGGESTION_LIMIT);
}
