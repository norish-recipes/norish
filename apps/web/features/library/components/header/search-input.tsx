"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Filters } from "@/features/library/components/filters";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Input } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

import { useImportRecipe, useLibraryFilters } from "@norish/shared-react/recipes";
import { isUrl } from "@norish/shared/lib/helpers";

export default function SearchInput() {
  const t = useTranslations("recipes.dashboard");
  const rawInput = useLibraryFilters((state) => state.filters.rawInput);
  const hasTags = useLibraryFilters((state) => state.filters.searchTags.length > 0);
  const setFilters = useLibraryFilters((state) => state.setFilters);
  const { importRecipe } = useImportRecipe();
  const [inputValue, setInputValue] = useState(rawInput);
  const [debouncedValue] = useDebounceValue(inputValue, 300);
  const [syncedRawInput, setSyncedRawInput] = useState(rawInput);

  // Sync external filter changes to input (e.g., from clear button elsewhere).
  // Only a change to the filter from elsewhere syncs in; typing must not.
  if (rawInput !== syncedRawInput) {
    setSyncedRawInput(rawInput);

    if (rawInput !== inputValue.trim()) {
      setInputValue(rawInput);
    }
  }

  // Sync debounced value to filters, but never echo back a value the filter
  // already holds (such as one just synced in from elsewhere)
  const applyDebouncedValue = useEffectEvent((value: string) => {
    // Don't trigger if it's a URL (handled immediately in handleChange)
    if (value !== rawInput && !isUrl(value)) {
      setFilters({ rawInput: value });
    }
  });

  useEffect(() => {
    applyDebouncedValue(debouncedValue.trim());
  }, [debouncedValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const trimmedValue = rawValue.trim();

    // Handle URL imports immediately (no debounce)
    if (isUrl(trimmedValue)) {
      setInputValue("");
      setFilters({ rawInput: "" });
      importRecipe(trimmedValue);
    } else {
      // Regular text - just update input, debounce handles filter sync
      setInputValue(rawValue);
    }
  };

  const hasFilters = rawInput.trim().length > 0 || hasTags;

  return (
    <div className="flex w-full items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <MagnifyingGlassIcon
          className={`pointer-events-none absolute top-1/2 left-4 z-10 h-5 w-5 -translate-y-1/2 ${
            hasFilters ? "text-accent animate-pulse" : "text-muted"
          }`}
        />
        <Input
          fullWidth
          className="bg-field shadow-field focus-visible:border-accent/60 focus-visible:ring-accent/20 h-12 rounded-full border border-transparent px-11 text-[15px] transition-colors outline-none focus-visible:ring-2"
          id="search-input"
          placeholder={t("searchPlaceholder")}
          style={{
            fontSize: "16px",
            paddingLeft: "2.75rem",
            paddingRight: inputValue.length > 0 ? "2.75rem" : "1rem",
          }}
          value={inputValue}
          variant="primary"
          onChange={handleChange}
        />
        {inputValue.length > 0 && (
          <button
            aria-label="Clear search"
            className="text-muted hover:bg-surface-secondary hover:text-foreground absolute top-1/2 right-2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
            type="button"
            onClick={() => {
              setInputValue("");
              setFilters({ rawInput: "" });
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      <Filters />
    </div>
  );
}
