import { stripHtmlTags } from "@norish/shared/lib/helpers";

/** Folds a name as the tags' `lower(name)` unique index does. */
const fold = (name: string) => name.toLowerCase();

/** Whether saving `next` over `saved` would change what the server stores. */
export function changesAllergies(next: readonly string[], saved: readonly string[]) {
  const savedTags = new Set(saved.map(fold));
  // A chip still holding a saved name is already stored form; cleaning it again can change it.
  const nextTags = new Set(
    next
      .map((name) => (savedTags.has(fold(name)) ? fold(name) : fold(stripHtmlTags(name))))
      .filter(Boolean)
  );

  return nextTags.size !== savedTags.size || [...nextTags].some((tag) => !savedTags.has(tag));
}
