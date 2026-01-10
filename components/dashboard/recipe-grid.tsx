"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "@heroui/react";
import { useWindowSize } from "usehooks-ts";

import RecipeCardSkeleton from "../skeleton/recipe-card-skeleton";
import RecipeGridSkeleton from "../skeleton/recipe-grid-skeleton";

import RecipeCard from "./recipe-card";
import NoRecipesText from "./no-recipes-text";
import NoRecipeResults from "./no-recipe-results";

import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";
import { useContainerColumns } from "@/hooks/use-container-columns";

// Estimated row height (card height + gap)
const ESTIMATED_ROW_HEIGHT = 380;

export default function RecipeGrid() {
  const {
    recipes,
    isLoading,
    isFetchingMore,
    hasMore: _hasMore,
    loadMore,
    pendingRecipeIds,
  } = useRecipesContext();
  const { filters, clearFilters } = useRecipesFiltersContext();
  const { saveScrollState, getScrollState } = useScrollRestoration(filters);

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isLoadedOnce, setIsLoadedOnce] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredLoadMoreRef = useRef(false);

  // Responsive column count from CSS variable
  const columnCount = useContainerColumns();

  // Track window size to recalculate scrollMargin on resize
  const { height: _windowHeight } = useWindowSize();

  // Calculate scrollMargin from container position
  const scrollMargin = useMemo(() => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();

    return rect.top + window.scrollY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_windowHeight]); // Recalculate when window resizes

  // Merge pending skeletons with actual recipes
  const displayData = useMemo(() => {
    const pendingSkeletons = Array.from(pendingRecipeIds).map((id) => ({
      id,
      isLoading: true,
    }));

    return [...pendingSkeletons, ...recipes];
  }, [pendingRecipeIds, recipes]);

  // Calculate row count for virtualization
  const rowCount = useMemo(() => {
    return Math.ceil(displayData.length / columnCount);
  }, [displayData.length, columnCount]);

  // Get saved scroll state for initialization
  const savedState = getScrollState();

  // Window virtualizer for row-based virtualization
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 3,
    scrollMargin,
    initialOffset: savedState?.scrollOffset,
    initialMeasurementsCache: savedState?.measurementsCache,
    onChange: (instance) => {
      // Save state when not scrolling (after scroll settles)
      if (!instance.isScrolling) {
        saveScrollState(instance.scrollOffset ?? 0, instance.measurementsCache);
      }
    },
  });

  const virtualRows = virtualizer.getVirtualItems();

  // Infinite scroll: trigger loadMore when near the end
  useEffect(() => {
    if (virtualRows.length === 0) return;

    const lastRow = virtualRows[virtualRows.length - 1];

    if (!lastRow) return;

    // Check if we're within 2 rows of the end
    const isNearEnd = lastRow.index >= rowCount - 2;

    if (isNearEnd && !isFetchingMore && !hasTriggeredLoadMoreRef.current) {
      hasTriggeredLoadMoreRef.current = true;
      loadMore();
    }

    // Reset the trigger when we're no longer near the end
    if (!isNearEnd) {
      hasTriggeredLoadMoreRef.current = false;
    }
  }, [virtualRows, rowCount, isFetchingMore, loadMore]);

  // Show skeleton loading state logic
  useEffect(() => {
    if (!isLoadedOnce && isLoading) {
      setShowSkeleton(true);

      return;
    }

    if (!isLoading) {
      setIsLoadedOnce(true);
      setShowSkeleton(false);

      return;
    }

    if (isLoadedOnce && isLoading) {
      const timeout = setTimeout(() => setShowSkeleton(true), 100);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, recipes.length, isLoadedOnce]);

  // Check for empty states
  const hasAppliedFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;

    return hasSearch || hasTags;
  }, [filters.rawInput, filters.searchTags]);

  const showEmptyState = !isLoading && displayData.length === 0;

  // Render a single item (skeleton or card)
  const renderItem = useCallback((item: (typeof displayData)[number]) => {
    if ("isLoading" in item && item.isLoading) {
      return <RecipeCardSkeleton key={`skeleton-${item.id}`} />;
    }

    return <RecipeCard key={`recipe-${item.id}`} recipe={item as any} />;
  }, []);

  // Show skeleton during initial load
  if (showSkeleton) return <RecipeGridSkeleton />;

  return (
    <div ref={containerRef} className="relative flex h-full flex-col">
      {showEmptyState ? (
        hasAppliedFilters ? (
          <NoRecipeResults onClear={clearFilters} />
        ) : (
          <NoRecipesText />
        )
      ) : (
        <>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              // Calculate which items belong to this row
              const startIndex = virtualRow.index * columnCount;
              const rowItems = displayData.slice(startIndex, startIndex + columnCount);

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((item) => (
                      <div key={item.id} className="p-2">
                        {renderItem(item)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {isFetchingMore && (
            <div className="flex justify-center py-8">
              <Spinner color="primary" size="lg" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
