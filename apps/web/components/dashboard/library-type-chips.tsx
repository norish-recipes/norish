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
 */
export default function LibraryTypeChips() {
  const t = useTranslations("recipes.dashboard");
  const { filters, setFilters } = useRecipesFiltersContext();
  const [, startTransition] = useTransition();

  return (
    <div
      aria-label={t("libraryType.label")}
      className="scrollbar-hide flex gap-1.5 overflow-x-auto px-1 pb-1"
      role="group"
    >
      {LIBRARY_TYPE_FILTERS.map((type) => {
        const isSelected = filters.libraryType === type;

        return (
          <Chip
            key={type}
            aria-pressed={isSelected}
            as="button"
            className="chip--on-ground shrink-0 cursor-pointer select-none"
            color={isSelected ? "accent" : "default"}
            data-library-type={type}
            size="sm"
            type="button"
            // Switching the lens re-queries and re-sorts the whole Library.
            // That is not work the tap should wait on.
            variant={isSelected ? "primary" : "tertiary"}
            onClick={() => startTransition(() => setFilters({ libraryType: type }))}
          >
            {t(`libraryType.${type}`)}
          </Chip>
        );
      })}
    </div>
  );
}
