"use client";

import { useTransition } from "react";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { LIBRARY_TYPE_FILTERS } from "@norish/shared/contracts";

/**
 * All, Recipes, Cookbooks — the lens on what kind of thing the Library shows.
 *
 * These are permanently on screen rather than revealed on search focus,
 * because under the default sort an old cookbook sinks into the Library just
 * as an old recipe does, and this is the control that finds it again. The Add
 * button's meaning depends on which one is lit, which is the other reason they
 * cannot move back behind a focus state (ADR-0026).
 *
 * They are sized as a control rather than as a label, because that is what
 * they are: a lens that renames the page and changes what the Add button
 * makes has to look at least as substantial as the search field beside it. The
 * unlit ones take a real fill and a border so the group reads as three
 * choices with one of them taken, rather than as one chip and two ghosts.
 */
export default function LibraryTypeChips() {
  const t = useTranslations("recipes.dashboard");
  const { filters, setFilters } = useRecipesFiltersContext();
  const [, startTransition] = useTransition();

  return (
    <div
      aria-label={t("libraryType.label")}
      className="scrollbar-hide flex gap-2 overflow-x-auto px-1 pb-1"
      role="group"
    >
      {LIBRARY_TYPE_FILTERS.map((type) => {
        const isSelected = filters.libraryType === type;

        return (
          <Chip
            key={type}
            aria-pressed={isSelected}
            as="button"
            className={`chip--on-ground h-9 shrink-0 cursor-pointer rounded-full border px-4 transition-colors select-none ${
              isSelected
                ? "border-accent shadow-surface"
                : "border-border text-muted hover:border-accent hover:text-foreground"
            }`}
            color={isSelected ? "accent" : "default"}
            data-library-type={type}
            size="lg"
            type="button"
            // Switching the lens re-queries and re-sorts the whole Library.
            // That is not work the tap should wait on.
            variant={isSelected ? "primary" : "secondary"}
            onClick={() => startTransition(() => setFilters({ libraryType: type }))}
          >
            {t(`libraryType.${type}`)}
          </Chip>
        );
      })}
    </div>
  );
}
