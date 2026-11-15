"use client";

import LibraryHeader, {
  LIBRARY_HEADING_ID,
} from "@/features/library/components/header/library-header";
import { RecipeViewModeTabs } from "@/features/library/components/header/recipe-view-mode-toggle";

import { RecipeGridSkeletonPanels } from "./recipe-grid-skeleton";

/** The dashboard's Library before its list is read: the live header over grey cards. */
export default function LibrarySkeleton() {
  return (
    <section aria-labelledby={LIBRARY_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <RecipeViewModeTabs>
        <LibraryHeader />
        <RecipeGridSkeletonPanels />
      </RecipeViewModeTabs>
    </section>
  );
}
