"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ListFrame } from "@/components/shared/list-row";
import { Spinner } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "usehooks-ts";

import type { IngredientTreeRow } from "@norish/shared-react/ingredients";

import { IngredientRow } from "./ingredient-row";

/** A two-line row is 60 px high; the virtualizer measures the real height. */
const ESTIMATED_ROW_HEIGHT = 60;
const ROW_OVERSCAN = 12;
/** How far below the viewport the end of the list is watched for, so the next page is there before the end is. */
const LOAD_MORE_MARGIN = "600px";

/**
 * The rows, virtualised against the window; an IntersectionObserver on the list's end asks for the
 * next page, so a page shorter than the window still asks.
 */
export function IngredientList({
  rows,
  settling,
  hasMore,
  isFetchingMore,
  loadMore,
  onOpen,
  onToggleKinds,
}: {
  /** The foods to list, in order, each with its depth in the tree. */
  rows: IngredientTreeRow[];
  /** A search or filter is being applied: the list dims but stays. */
  settling: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  onOpen: (id: string) => void;
  /** Fold a food's kinds out or back; absent where the list is flat. */
  onToggleKinds?: (id: string) => void;
}) {
  // TanStack Virtual hands back one mutable instance, so compiled memoisation
  // would keep its first rows.
  "use no memo";

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Whether the end of the list is within reach of the viewport.
  const [atEnd, setAtEnd] = useState(false);
  const { height: windowHeight } = useWindowSize();
  const isEmpty = rows.length === 0;
  // No gutter for an expander when no row has kinds to fold out.
  const foldable = rows.some((row) => row.item.kinds > 0);

  // Where the list starts on the page, which the virtualizer measures from; read again on resize
  // and once rows arrive.
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY);
  }, [windowHeight, isEmpty]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: ROW_OVERSCAN,
    scrollMargin,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const end = endRef.current;

    if (!end || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setAtEnd(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: LOAD_MORE_MARGIN }
    );

    observer.observe(end);

    return () => observer.disconnect();
  }, []);

  // Ask while the end stays in reach: after a page lands it may still be.
  useEffect(() => {
    if (atEnd && hasMore && !isFetchingMore) loadMore();
  }, [atEnd, hasMore, isFetchingMore, rows.length, loadMore]);

  return (
    <div ref={containerRef} className="flex flex-col">
      <ListFrame
        aria-busy={settling}
        className={`transition-opacity ${settling ? "opacity-60" : ""}`}
        data-testid="ingredients-list"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        virtual
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];

          if (!row) return null;

          return (
            <IngredientRow
              key={row.item.id}
              ref={virtualizer.measureElement}
              depth={row.depth}
              expanded={row.expanded}
              index={virtualRow.index}
              item={row.item}
              loadingKinds={row.loading}
              offset={virtualRow.start - scrollMargin}
              onOpen={onOpen}
              onToggleKinds={foldable ? onToggleKinds : undefined}
            />
          );
        })}
      </ListFrame>
      <div ref={endRef} aria-hidden data-testid="ingredients-list-end" />
      {isFetchingMore ? (
        <div className="flex justify-center py-4" data-testid="ingredients-load-more">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}
    </div>
  );
}
