"use client";

import CookbookHeader from "@/features/library/components/header/cookbook-header";
import { RecipeViewModeTabs } from "@/features/library/components/header/recipe-view-mode-toggle";

import { RecipeGridSkeletonPanels } from "./recipe-grid-skeleton";

/** The cookbook page before its cookbook is read: its header and the Library's grid skeleton. */
export default function CookbookSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <RecipeViewModeTabs>
        <CookbookHeader />
        <RecipeGridSkeletonPanels />
      </RecipeViewModeTabs>
    </section>
  );
}
