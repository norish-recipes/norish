import type { Update } from "./profile-rules";
import { afterSave } from "./profile-rules";

const SUGGESTION_LIMIT = 8;
const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sorted = (names: readonly string[]) => names.slice().sort();

/** The chips show the draft until its save takes it, else the saved allergies, wherever they came from. */
export const shownAllergies = (draft: string[] | null, saved: string[]) => draft ?? saved;

/** What Save sends: the draft, or null when it holds the saved allergies (in any order). */
export function allergiesToSend(draft: string[] | null, saved: string[]) {
  if (draft === null) return null;

  return JSON.stringify(sorted(draft)) === JSON.stringify(sorted(saved)) ? null : draft;
}

/** A draft that would send nothing is dropped, so it can never undo what another device saved. */
export const keptAllergyDraft = ({
  draft,
  saved,
  saving,
}: {
  draft: string[] | null;
  saved: string[];
  saving: boolean;
}) => (saving || allergiesToSend(draft, saved) !== null ? draft : null);

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

/** Save is on only with something to save, and never while saving or Offline. */
export const canSaveAllergies = ({
  draft,
  saved,
  saving,
  offline,
}: {
  draft: string[] | null;
  saved: string[];
  saving: boolean;
  offline: boolean;
}) => !saving && !offline && allergiesToSend(draft, saved) !== null;

/** Sends the draft; it goes once the server took it, and one that is refused or stale stays. */
export async function saveAllergies({
  draft,
  saved,
  setAllergies,
  setDraft,
}: {
  draft: string[] | null;
  saved: string[];
  setAllergies: (allergies: string[]) => Promise<boolean>;
  setDraft: Update<string[]>;
}) {
  const allergies = allergiesToSend(draft, saved);

  if (allergies === null) return;

  const tookIt = await setAllergies(allergies);

  setDraft((current) => afterSave(current, draft, tookIt));
}
