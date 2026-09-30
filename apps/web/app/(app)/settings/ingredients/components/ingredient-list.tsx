"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "usehooks-ts";

import type { IngredientTreeRow } from "./use-ingredient-tree";
import { IngredientRow } from "./ingredient-row";

/** A row is two lines of text and its padding; the virtualizer measures the real height. */
const ESTIMATED_ROW_HEIGHT = 68;
const ROW_OVERSCAN = 12;
/** How far below the viewport the end of the list is watched for, so the next page is there before the end is. */
const LOAD_MORE_MARGIN = "600px";

/**
 * The catalogue's rows, virtualised against the window as the dashboard's
 * grid is: only the rows in and around view are in the tree. The next page
 * is asked for when the end of the list comes within reach of the viewport,
 * watched by an observer rather than read off the virtual rows, so a page
 * shorter than the window still asks for the next. Rows carry their own
 * state; this list only knows how tall they are.
 */
export function IngredientList({
  rows,
  reviewing,
  settling,
  hasMore,
  isFetchingMore,
  loadMore,
  onOpen,
  onToggleKinds,
}: {
  /** The foods to list, in order, each with its depth in the tree. */
  rows: IngredientTreeRow[];
  /** The foods waiting their turn in a round of Ask AI. */
  reviewing: ReadonlySet<string>;
  /** A search or filter is being applied: the list dims but stays. */
  settling: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  onOpen: (id: string) => void;
  /** Fold a food's kinds out or back; absent where the list is flat. */
  onToggleKinds?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // Whether the end of the list is within reach of the viewport.
  const [atEnd, setAtEnd] = useState(false);
  const { height: windowHeight } = useWindowSize();
  const isEmpty = rows.length === 0;

  // Where the list starts on the page; the virtualizer measures from there.
  // Read once the container is in the DOM, again on resize, and when the
  // list first has rows to place.
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
      <div
        className={`border-border relative overflow-hidden rounded-xl border transition-opacity ${settling ? "opacity-60" : ""}`}
        data-testid="ingredients-list"
        role="list"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];

          if (!row) return null;

          return (
            <div
              key={row.item.id}
              ref={virtualizer.measureElement}
              className={virtualRow.index > 0 ? "border-border border-t" : undefined}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <IngredientRow
                depth={row.depth}
                expanded={row.expanded}
                item={row.item}
                loadingKinds={row.loading}
                reviewing={reviewing.has(row.item.id)}
                onOpen={onOpen}
                onToggleKinds={onToggleKinds}
              />
            </div>
          );
        })}
      </div>
      <div ref={endRef} aria-hidden data-testid="ingredients-list-end" />
      {isFetchingMore ? (
        <div className="flex justify-center py-4" data-testid="ingredients-load-more">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}
    </div>
  );
}
