"use client";

import { FunnelIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useMemo, useState } from "react";

import { FiltersPanel } from "@/components/Panel/consumers";
import { cssGlassBackdrop } from "@/config/css-tokens";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";

type FiltersProps = {
  isGlass: boolean;
};

export default function Filters({ isGlass = false }: FiltersProps) {
  const { filters } = useRecipesFiltersContext();
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;
    const hasRating = filters.minRating !== null;

    return hasSearch || hasTags || hasRating;
  }, [filters.rawInput, filters.searchTags, filters.minRating]);

  return (
    <>
      <Button
        isIconOnly
        aria-label="Filters"
        className={`relative h-12 w-12 ${isGlass ? cssGlassBackdrop : "bg-default-100 hover:bg-default-200"}`}
        radius="full"
        variant="flat"
        onPress={() => setIsOpen(true)}
      >
        <FunnelIcon className="size-4" />
        {hasActiveFilters && (
          <span className="bg-primary shadow-background absolute top-2.5 right-2.5 inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px]" />
        )}
      </Button>

      <FiltersPanel open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
