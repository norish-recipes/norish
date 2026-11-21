"use client";

import FloatingRecipeChip from "@/features/library/components/filters/floating-recipe-chip";
import LibraryView from "@/features/library/components/grid/library-view";
import { RecipeViewModeTabs } from "@/features/library/components/header";
import LibraryHeader, {
  LIBRARY_HEADING_ID,
} from "@/features/library/components/header/library-header";
import { RecipeSelectionBar } from "@/features/library/components/selection";
import { Tabs } from "@heroui/react";

import { useLibraryList } from "@norish/shared-react/recipes";

/** The Library's screen, which the dashboard draws under Today's meals. */
export function LibraryScreen() {
  const { recipes } = useLibraryList();

  return (
    <>
      <section aria-labelledby={LIBRARY_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
        <RecipeViewModeTabs>
          <LibraryHeader />
          <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
            <LibraryView variant="grid" />
          </Tabs.Panel>
          <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
            <LibraryView variant="list" />
          </Tabs.Panel>
        </RecipeViewModeTabs>
      </section>
      <RecipeSelectionBar recipes={recipes} />
      <FloatingRecipeChip />
    </>
  );
}
