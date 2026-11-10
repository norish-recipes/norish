"use client";

import { FloatingRecipeChip } from "@/features/library/components/filters";
import { LibraryView } from "@/features/library/components/grid";
import {
  CreateRecipeButton,
  LibraryHeading,
  LibraryTypeChips,
  RecipeViewModeTabs,
  RecipeViewModeToggle,
  SearchInput,
} from "@/features/library/components/header";
import { RecipeSelectionBar } from "@/features/library/components/selection";
import { RecipeGridSkeleton } from "@/features/library/components/skeleton";
import { useLibraryList } from "@/features/library/hooks";
import { Tabs } from "@heroui/react";

const LIBRARY_HEADING_ID = "recipe-library-heading";

function RecipeLibraryContent({ skeleton }: { skeleton: boolean }) {
  return (
    <section aria-labelledby={LIBRARY_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <RecipeViewModeTabs>
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

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          {skeleton ? <RecipeGridSkeleton variant="grid" /> : <LibraryView variant="grid" />}
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          {skeleton ? <RecipeGridSkeleton variant="list" /> : <LibraryView variant="list" />}
        </Tabs.Panel>
      </RecipeViewModeTabs>
    </section>
  );
}

/**
 * The Library's screen, which the dashboard draws under Today's meals. `skeleton` is the route's
 * loading state: grey cards stand in for the Library, so its grid and scroll memory mount once.
 */
export function LibraryScreen({ skeleton = false }: { skeleton?: boolean }) {
  const { recipes } = useLibraryList();

  return (
    <>
      <RecipeLibraryContent skeleton={skeleton} />
      <RecipeSelectionBar recipes={recipes} />
      {skeleton ? null : <FloatingRecipeChip />}
    </>
  );
}
