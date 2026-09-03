"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { SearchField } from "@norish/shared/contracts";
import { toggleSearchFieldIn } from "@norish/shared-react/contexts";
import { SEARCH_FIELDS } from "@norish/shared/contracts";

interface SearchFieldTogglesProps {
  /** The working selection, held by whoever owns the Apply button. */
  value: readonly SearchField[];
  onChange: (next: SearchField[]) => void;
  className?: string;
  itemClassName?: string;
}

/**
 * The "Search in" group: which fields a search looks at.
 *
 * Controlled, because it lives in the Filters panel and applies with that
 * panel's Apply button rather than on each click.
 */
export default function SearchFieldToggles({
  value,
  onChange,
  className = "",
  itemClassName = "",
}: SearchFieldTogglesProps) {
  const t = useTranslations("recipes.dashboard");

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {SEARCH_FIELDS.map((field) => {
        const isSelected = value.includes(field);

        return (
          <Chip
            key={field}
            aria-pressed={isSelected}
            as="button"
            className={`shrink-0 cursor-pointer select-none ${itemClassName}`}
            color={isSelected ? "accent" : "default"}
            size="sm"
            type="button"
            variant={isSelected ? "primary" : "tertiary"}
            onClick={() => onChange(toggleSearchFieldIn(value, field))}
          >
            {t(`searchFields.${field}`)}
          </Chip>
        );
      })}
    </div>
  );
}
