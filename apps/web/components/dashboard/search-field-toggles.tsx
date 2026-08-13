"use client";

import { useTransition } from "react";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import { SEARCH_FIELDS } from "@norish/shared/contracts";

interface SearchFieldTogglesProps {
  className?: string;
  itemClassName?: string;
  onInteraction?: () => void;
  scrollable?: boolean;
}

export default function SearchFieldToggles({
  className = "",
  itemClassName = "",
  onInteraction,
  scrollable = false,
}: SearchFieldTogglesProps) {
  const t = useTranslations("recipes.dashboard");
  const { filters, toggleSearchField } = useRecipesFiltersContext();
  const [, startTransition] = useTransition();

  const handleClick = (field: (typeof SEARCH_FIELDS)[number]) => {
    onInteraction?.();
    // Changing a search field re-queries and re-sorts the whole library. That
    // is not work the click should wait on, so it goes in as a transition and
    // the page stays responsive while React prepares the new list.
    startTransition(() => toggleSearchField(field));
  };

  const containerClass = scrollable
    ? `flex gap-1.5 overflow-x-auto scrollbar-hide ${className}`
    : `flex flex-wrap gap-1.5 ${className}`;

  return (
    <div className={containerClass} onScroll={onInteraction} onTouchStart={onInteraction}>
      {SEARCH_FIELDS.map((field) => {
        const isSelected = filters.searchFields.includes(field);

        return (
          <Chip
            key={field}
            as="button"
            aria-pressed={isSelected}
            className={`shrink-0 cursor-pointer select-none ${itemClassName}`}
            color={isSelected ? "accent" : "default"}
            size="sm"
            type="button"
            variant={isSelected ? "primary" : "tertiary"}
            onClick={() => handleClick(field)}
          >
            {t(`searchFields.${field}`)}
          </Chip>
        );
      })}
    </div>
  );
}
