import type { SortOrder } from "@norish/shared/contracts";

/** The sorts that always apply, in the order the sort chip lists them. */
const EXPLICIT_SORTS: readonly SortOrder[] = ["dateDesc", "dateAsc", "titleAsc", "titleDesc"];

/** Best match is the server's `none`: rank while there is text, newest otherwise. It is Search's default. */
export const BEST_MATCH: SortOrder = "none";

/** The sorts offered: Best match only while there is text to match. */
export const sortOptions = (hasText: boolean): readonly SortOrder[] =>
  hasText ? [BEST_MATCH, ...EXPLICIT_SORTS] : EXPLICIT_SORTS;

/** The sort the chip names: with no text `none` is newest, so Best match is never shown for it. */
export const shownSort = (sortMode: SortOrder, hasText: boolean): SortOrder =>
  sortMode === BEST_MATCH && !hasText ? "dateDesc" : sortMode;
