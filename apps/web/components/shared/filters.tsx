"use client";

import { useState } from "react";
import { FiltersPanel } from "@/components/Panel/consumers";
import { FunnelIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";

import { useLibraryFilters } from "@norish/shared-react/recipes";

export default function Filters() {
  const hasActiveFilters = useLibraryFilters(
    ({ filters }) =>
      filters.rawInput.trim().length > 0 ||
      filters.searchTags.length > 0 ||
      filters.categories.length > 0 ||
      filters.minRating !== null ||
      filters.maxCookingTime !== null ||
      filters.showPantryOnly
  );
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        isIconOnly
        aria-label="Filters"
        className="shadow-field bg-field hover:bg-field-hover dark:bg-default dark:hover:bg-surface-tertiary relative h-12 w-12 border border-transparent"
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
