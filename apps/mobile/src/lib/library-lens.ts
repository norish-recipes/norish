import { useEffect } from "react";
import { createMark } from "@/lib/mark";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

// A mark, as the tab bar's accessory and the Library live in separate trees; the Library clears it
// when it unmounts.
const lens = createMark<LibraryTypeFilter>("all");

/** The lens the Library shows: All, Recipes or Cookbooks. */
export const useLibraryLens = lens.use;

/** Marks `type` as the lens the Library shows, until the Library unmounts. */
export function useMarkLibraryLens(type: LibraryTypeFilter) {
  useEffect(() => lens.set(type), [type]);
  useEffect(() => () => lens.set("all"), []);
}
