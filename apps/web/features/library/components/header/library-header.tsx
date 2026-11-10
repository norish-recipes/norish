"use client";

import CreateRecipeButton from "./create-recipe-button";
import LibraryHeading from "./library-heading";
import LibraryTypeChips from "./library-type-chips";
import RecipeViewModeToggle from "./recipe-view-mode-toggle";
import SearchInput from "./search-input";

export const LIBRARY_HEADING_ID = "recipe-library-heading";

/** The Library's header: its heading, the view toggle and Add, then the search and type chips. */
export default function LibraryHeader() {
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <LibraryHeading id={LIBRARY_HEADING_ID} />
        <div className="flex items-center gap-2">
          <RecipeViewModeToggle />
          <CreateRecipeButton />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <SearchInput />
        <LibraryTypeChips />
      </div>
    </div>
  );
}
