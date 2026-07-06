"use client";

import { useMemo, useState } from "react";
import { FiltersPanel } from "@/components/Panel/consumers";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { FunnelIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { cssGlassBackdrop } from "@norish/web/config/css-tokens";

type FiltersProps = {
  isGlass: boolean;
};
export default function Filters({ isGlass = false }: FiltersProps) {
  const { filters } = useRecipesFiltersContext();
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;
    const hasCategories = filters.categories.length > 0;
    const hasRating = filters.minRating !== null;
    const hasCookingTime = filters.maxCookingTime !== null;
    return hasSearch || hasTags || hasCategories || hasRating || hasCookingTime;
  }, [
    filters.rawInput,
    filters.searchTags,
    filters.categories,
    filters.minRating,
    filters.maxCookingTime,
  ]);
  return (
    <>
      <Button
        isIconOnly
        aria-label="Filters"
        className={`shadow-field relative h-12 w-12 border border-transparent ${isGlass ? cssGlassBackdrop : "bg-field hover:bg-field-hover dark:bg-default dark:hover:bg-surface-tertiary"}`}
        onPress={() => setIsOpen(true)}
        variant="tertiary"
      >
        <FunnelIcon className="size-4" />
        {hasActiveFilters && (
          <span className="bg-accent shadow-background absolute top-2.5 right-2.5 inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px]" />
        )}
      </Button>

      <FiltersPanel open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
