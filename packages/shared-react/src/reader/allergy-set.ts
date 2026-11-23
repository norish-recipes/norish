import { stripHtmlTags } from "@norish/shared/lib/helpers";

/** The tags the server would store for `names`: cleaned, one per name in any case. */
const storedTags = (names: readonly string[]) =>
  new Set(names.map((name) => stripHtmlTags(name).toLowerCase()).filter(Boolean));

/** Whether saving `next` over `saved` would change what the server stores. */
export function changesAllergies(next: readonly string[], saved: readonly string[]) {
  const nextTags = storedTags(next);
  const savedTags = storedTags(saved);

  return nextTags.size !== savedTags.size || [...nextTags].some((tag) => !savedTags.has(tag));
}
