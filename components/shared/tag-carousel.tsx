"use client";

import React, { useMemo, useCallback } from "react";
import { Chip } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useTagsQuery } from "@/hooks/config";
import { parseSearchTokens, findBestMatchingToken } from "@/lib/helpers";

export interface TagCarouselProps {
  className?: string;
  variant?: "default" | "compact" | "large";
}

type ChipData = {
  id: string;
  label: string;
  type: "selected" | "suggested";
};

export default function TagCarousel({ className = "", variant = "default" }: TagCarouselProps) {
  const { filters, setFilters } = useRecipesFiltersContext();
  const { tags: allTags, isLoading: _isLoading } = useTagsQuery();

  // Parse tokens from raw input, excluding already selected tags
  const activeTokens = useMemo(() => {
    return parseSearchTokens(filters.rawInput, filters.searchTags);
  }, [filters.rawInput, filters.searchTags]);

  const suggestions = useMemo(() => {
    if (!activeTokens.length) return [];
    const results: { t: string; score: number }[] = [];

    activeTokens.forEach((tok) => {
      const lower = tok.toLowerCase();

      allTags.forEach((tag) => {
        const tl = tag.toLowerCase();

        if (!tl.includes(lower)) return;
        if (filters.searchTags.some((sel) => sel.toLowerCase() === tl)) return;

        let base = 2;

        if (tl === lower) base = 0;
        else if (tl.startsWith(lower)) base = 1;

        const score = base * 10 + Math.abs(tag.length - lower.length);

        results.push({ t: tag, score });
      });
    });

    return results.sort((a, b) => a.score - b.score || a.t.localeCompare(b.t)).map((r) => r.t);
  }, [activeTokens, allTags, filters.searchTags]);

  // Handle removing a selected tag
  const handleRemoveSelected = useCallback(
    (tag: string) => {
      setFilters({
        searchTags: filters.searchTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
      });
    },
    [filters.searchTags, setFilters]
  );

  // Handle clicking a suggested tag
  const handleAddSuggested = useCallback(
    (tag: string) => {
      // Check if already selected
      if (filters.searchTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        return;
      }

      // Find and remove the best matching token from rawInput
      const bestMatch = findBestMatchingToken(tag, filters.rawInput);
      let newRawInput = filters.rawInput;

      if (bestMatch) {
        // Remove the best matching token from input
        const tokens = filters.rawInput.split(/\s+/).filter((t) => t !== bestMatch);

        newRawInput = tokens.join(" ").trim();
      }

      setFilters({
        searchTags: [...filters.searchTags, tag],
        rawInput: newRawInput,
      });
    },
    [filters.searchTags, filters.rawInput, setFilters]
  );

  // Combine selected and suggested into unified array for animation
  const allChips = useMemo<ChipData[]>(() => {
    const selected: ChipData[] = filters.searchTags.map((tag) => ({
      id: `selected-${tag}`,
      label: tag,
      type: "selected" as const,
    }));

    const suggested: ChipData[] = suggestions.map((tag) => ({
      id: `suggested-${tag}`,
      label: tag,
      type: "suggested" as const,
    }));

    return [...selected, ...suggested];
  }, [filters.searchTags, suggestions]);

  const gap = variant === "compact" ? "gap-0.5" : "gap-1";
  const chipSize =
    variant === "compact"
      ? "h-5 text-[10px] px-1.5"
      : variant === "large"
        ? "h-7 text-[12px] px-3"
        : "h-7 text-[11px] px-2";

  return (
    <div
      className={`flex flex-nowrap items-center ${gap} no-scrollbar overflow-x-auto overflow-y-hidden px-1 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <AnimatePresence mode="popLayout">
        {allChips.map((chip) => {
          const isSelected = chip.type === "selected";

          return (
            <motion.div
              key={chip.id}
              animate={{ opacity: 1, scale: 1 }}
              className="shrink-0"
              exit={{ opacity: 0, scale: 0.8 }}
              initial={{ opacity: 0, scale: 0.8 }}
              layoutId={chip.id}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 35,
                mass: 0.5,
              }}
            >
              <Chip
                className={`cursor-pointer font-medium ${chipSize} ${!isSelected ? "bg-default-200 dark:bg-default-100 text-default-700" : ""
                  }`}
                color={isSelected ? "primary" : "default"}
                radius="full"
                size="sm"
                variant="solid"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelected) {
                    handleRemoveSelected(chip.label);
                  } else {
                    handleAddSuggested(chip.label);
                  }
                }}
              >
                {chip.label}
              </Chip>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
