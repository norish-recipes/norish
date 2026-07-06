"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Input } from "@heroui/react";
import { useTranslations } from "next-intl";
import { useDebounceValue } from "usehooks-ts";

import { isUrl } from "@norish/shared/lib/helpers";

import Filters from "../shared/filters";
import SearchFieldToggles from "./search-field-toggles";

export default function SearchInput() {
  const t = useTranslations("recipes.dashboard");
  const { filters, setFilters } = useRecipesFiltersContext();
  const { importRecipe } = useRecipesContext();
  const [inputValue, setInputValue] = useState(filters.rawInput);
  const [debouncedValue] = useDebounceValue(inputValue, 300);
  const [isFocused, setIsFocused] = useState(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const skipNextDebounceRef = useRef(false);

  // Sync debounced value to filters (but skip when external sync happens)
  useEffect(() => {
    if (skipNextDebounceRef.current) {
      skipNextDebounceRef.current = false;

      return;
    }
    // Don't trigger if it's a URL (handled immediately in handleChange)
    if (!isUrl(debouncedValue.trim())) {
      setFilters({ rawInput: debouncedValue.trim() });
    }
  }, [debouncedValue, setFilters]);

  // Sync external filter changes to input (e.g., from clear button elsewhere)
  useEffect(() => {
    if (filters.rawInput !== inputValue.trim()) {
      skipNextDebounceRef.current = true;
      setInputValue(filters.rawInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.rawInput]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const trimmedValue = rawValue.trim();

    // Handle URL imports immediately (no debounce)
    if (isUrl(trimmedValue)) {
      setInputValue("");
      setFilters({ rawInput: "" });
      void importRecipe(trimmedValue);
    } else {
      // Regular text - just update input, debounce handles filter sync
      setInputValue(rawValue);
    }
  };

  const handleBlur = () => {
    // Delay blur to allow clicks on toggles to register
    blurTimeoutRef.current = setTimeout(() => {
      setIsFocused(false);
    }, 2000);
  };

  const handleFocus = () => {
    // Cancel any pending blur
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsFocused(true);
  };

  // Reset hide timer when interacting with toggles
  const resetHideTimer = useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        setIsFocused(false);
      }, 2000);
    }
  }, []);

  const hasFilters = filters.rawInput.trim().length > 0 || filters.searchTags.length > 0;
  const showFieldToggles = isFocused || inputValue.trim().length > 0;

  return (
    <div className="flex w-full flex-col gap-2">
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
            onBlur={handleBlur}
            onChange={handleChange}
            onFocus={handleFocus}
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
        <Filters isGlass={false} />
      </div>
      {/* Use grid for height animation - avoids layout thrashing on desktop */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{
          gridTemplateRows: showFieldToggles ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <SearchFieldToggles scrollable className="px-1 pb-1" onInteraction={resetHideTimer} />
        </div>
      </div>
    </div>
  );
}
