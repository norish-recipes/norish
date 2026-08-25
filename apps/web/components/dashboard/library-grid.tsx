"use client";

import type { LibraryGridItem } from "@/lib/library-items";
import type { RecipeDashboardViewMode } from "@/lib/recipe-view-mode";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useContainerColumns } from "@/hooks/use-container-columns";
import { Spinner } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "usehooks-ts";

import { useScrollRestoration } from "@norish/shared-react/hooks";

import RecipeGridSkeleton from "../skeleton/recipe-grid-skeleton";

// Estimated row height (card height + gap). Both kinds of card match these,
// or the estimate degrades for every row on a mixed page (ADR-0026).
const ESTIMATED_GRID_ROW_HEIGHT = 356;
const ESTIMATED_LIST_ROW_HEIGHT = 144;
const GRID_ROW_OVERSCAN = 3;
const LIST_ROW_OVERSCAN = 12;
const GRID_LOAD_MORE_ROW_THRESHOLD = 2;
const LIST_LOAD_MORE_ROW_THRESHOLD = 6;

type LibraryGridProps = {
  variant: RecipeDashboardViewMode;
  items: LibraryGridItem[];
  isLoading: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  /** Scroll position is remembered per set of filters. */
  scrollKey: string;
  /** What to draw when the list is empty and nothing is loading. */
  emptyState: React.ReactNode;
  renderItem: (item: LibraryGridItem) => React.ReactNode;
};

/**
 * The Library's virtualizing shell: one window virtualizer, one row-height
 * estimate per view mode, infinite scroll and scroll restoration — and no
 * opinion at all about what a row contains.
 *
 * Everything that knows about recipes or cookbooks lives in `renderItem`,
 * which is what lets one list hold both kinds.
 */
export default function LibraryGrid({
  variant,
  items,
  isLoading,
  isFetchingMore,
  loadMore,
  scrollKey,
  emptyState,
  renderItem,
}: LibraryGridProps) {
  const { saveScrollState, getScrollState } = useScrollRestoration(scrollKey);

  // Seeded from `isLoading` so the skeleton is part of the very first paint —
  // server render included. Starting at `false` and flipping in the effect
  // below paints a blank grid for a frame or two, and on a fast network the
  // data then pops in with no skeleton ever shown.
  const [showSkeleton, setShowSkeleton] = useState(() => isLoading);
  const [isLoadedOnce, setIsLoadedOnce] = useState(() => !isLoading);
  // Each tab panel mounts its own grid with the presentation fixed, so a view
  // switch swaps panels rather than re-laying out this one in place.
  const viewMode = variant;
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredLoadMoreRef = useRef(false);

  // Responsive column count from CSS variable
  const columnCount = useContainerColumns();
  const effectiveColumnCount = viewMode === "list" ? 1 : columnCount;
  const rowOverscan = viewMode === "list" ? LIST_ROW_OVERSCAN : GRID_ROW_OVERSCAN;
  const loadMoreRowThreshold =
    viewMode === "list" ? LIST_LOAD_MORE_ROW_THRESHOLD : GRID_LOAD_MORE_ROW_THRESHOLD;

  // Track window size to recalculate scrollMargin on resize
  const { height: _windowHeight } = useWindowSize();

  // Calculate scrollMargin from container position
  const scrollMargin = useMemo(() => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();

    return rect.top + window.scrollY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_windowHeight]); // Recalculate when window resizes

  const rowCount = useMemo(
    () => Math.ceil(items.length / effectiveColumnCount),
    [items.length, effectiveColumnCount]
  );

  // Get saved scroll state for initialization
  const savedState = getScrollState();

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () =>
      viewMode === "list" ? ESTIMATED_LIST_ROW_HEIGHT : ESTIMATED_GRID_ROW_HEIGHT,
    overscan: rowOverscan,
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

  useEffect(() => {
    virtualizer.measure();
  }, [effectiveColumnCount, viewMode, virtualizer]);

  // Infinite scroll: trigger loadMore when near the end
  useEffect(() => {
    if (virtualRows.length === 0) return;

    const lastRow = virtualRows[virtualRows.length - 1];

    if (!lastRow) return;

    const isNearEnd = lastRow.index >= rowCount - loadMoreRowThreshold;

    if (isNearEnd && !isFetchingMore && !hasTriggeredLoadMoreRef.current) {
      hasTriggeredLoadMoreRef.current = true;
      loadMore();
    }

    // Reset the trigger when we're no longer near the end
    if (!isNearEnd) {
      hasTriggeredLoadMoreRef.current = false;
    }
  }, [virtualRows, rowCount, loadMoreRowThreshold, isFetchingMore, loadMore]);

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
      // Swapping a loaded library for a grid of skeletons is the single most
      // expensive render on this page, and it fires from a timer while the
      // reader is still interacting with the control that caused it. As a
      // transition it can be interrupted rather than blocking the frame.
      const timeout = setTimeout(() => startTransition(() => setShowSkeleton(true)), 100);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, items.length, isLoadedOnce]);

  const showEmptyState = !isLoading && items.length === 0;

  const renderRow = useCallback(
    (rowIndex: number) =>
      items.slice(
        rowIndex * effectiveColumnCount,
        rowIndex * effectiveColumnCount + effectiveColumnCount
      ),
    [items, effectiveColumnCount]
  );

  // Show skeleton during initial load
  if (showSkeleton) return <RecipeGridSkeleton variant={viewMode} />;

  return (
    <div
      ref={containerRef}
      className="relative flex h-full flex-col"
      style={{ containIntrinsicSize: "0 500px" }}
    >
      {showEmptyState ? (
        emptyState
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
              const rowItems = renderRow(virtualRow.index);

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className="pb-4"
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
                    className={viewMode === "list" ? "flex flex-col gap-4" : "grid gap-4"}
                    style={{
                      gridTemplateColumns:
                        viewMode === "list"
                          ? undefined
                          : `repeat(${effectiveColumnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowItems.map((item) => (
                      <div key={`${item.kind}-${item.id}`}>{renderItem(item)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {isFetchingMore && (
            <div className="flex justify-center py-8">
              <Spinner color="accent" size="lg" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
