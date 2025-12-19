"use client";

import React, { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { VirtuosoGrid } from "react-virtuoso";

import RecipeCardSkeleton from "../skeleton/recipe-card-skeleton";
import RecipeGridSkeleton from "../skeleton/recipe-grid-skeleton";

import RecipeCard from "./recipe-card";
import NoRecipesText from "./no-recipes-text";
import NoRecipeResults from "./no-recipe-results";

import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useScrollRestoration } from "@/hooks/use-scroll-restoration";

const ListComponent = React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
  ({ style, ...props }, ref) => (
    <div ref={ref} {...props} className="flex flex-wrap gap-4" style={{ ...style }} />
  )
);

ListComponent.displayName = "ListComponent";

const ItemComponent = React.memo((props: React.HTMLProps<HTMLDivElement>) => (
  <div {...props} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]" />
));

ItemComponent.displayName = "ItemComponent";

const gridComponents = { List: ListComponent, Item: ItemComponent };

export default function RecipeGrid() {
  const { recipes, isLoading, hasMore: _hasMore, loadMore, pendingRecipeIds } = useRecipesContext();
  const { filters, clearFilters } = useRecipesFiltersContext();
  const { saveScrollState, getScrollState } = useScrollRestoration(filters);

  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isLoadedOnce, setIsLoadedOnce] = useState(false);
  const virtuosoRef = useRef<any>(null);
  const prevFiltersRef = useRef(filters);

  // Get initial scroll index from saved state
  const initialTopMostItemIndex = useMemo(() => {
    const savedState = getScrollState();
    const savedIndex = savedState?.firstItemIndex ?? 0;

    return Math.max(0, savedIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore exact scroll position after Virtuoso renders
  useEffect(() => {
    const savedState = getScrollState();

    if (savedState?.scrollTop && savedState.scrollTop > 0) {
      // Wait for Virtuoso to fully render before restoring scroll
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo(0, savedState.scrollTop);
        }, 50);
      });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track filter changes to update the prevFiltersRef
  useEffect(() => {
    prevFiltersRef.current = filters;
  }, [filters]);

  const displayData = useMemo(() => {
    const pendingSkeletons = Array.from(pendingRecipeIds).map((id) => ({
      id,
      isLoading: true,
    }));

    return [...pendingSkeletons, ...recipes];
  }, [pendingRecipeIds, recipes]);

  const hasAppliedFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;

    return hasSearch || hasTags;
  }, [filters.rawInput, filters.searchTags]);

  const showEmptyState = !isLoading && displayData.length === 0;

  const itemContent = useCallback(
    (_: number, item: any) =>
      item.isLoading ? (
        <RecipeCardSkeleton key={`skeleton-${item.id}`} />
      ) : (
        <RecipeCard key={`recipe-${item.id}`} recipe={item} />
      ),
    []
  );

  // Stable item keys to prevent re-renders
  const computeItemKey = useCallback(
    (index: number) => {
      const item = displayData[index];

      return item?.id ?? `item-${index}`;
    },
    [displayData]
  );

  // Track scroll position and first visible item to save (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleRangeChanged = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      // Debounce saves to avoid excessive updates
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveScrollState(window.scrollY, range.startIndex);
      }, 150);
    },
    [saveScrollState]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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

  if (showSkeleton) return <RecipeGridSkeleton />;

  return (
    <div className="relative flex h-full flex-col">
      {showEmptyState ? (
        hasAppliedFilters ? (
          <NoRecipeResults onClear={clearFilters} />
        ) : (
          <NoRecipesText />
        )
      ) : (
        <VirtuosoGrid
          ref={virtuosoRef}
          useWindowScroll
          components={gridComponents}
          computeItemKey={computeItemKey}
          data={displayData}
          endReached={loadMore}
          initialTopMostItemIndex={initialTopMostItemIndex}
          itemContent={itemContent}
          overscan={800}
          rangeChanged={handleRangeChanged}
        />
      )}
    </div>
  );
}
