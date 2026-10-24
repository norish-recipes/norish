"use client";

import type { EquipmentItem } from "@/components/equipment/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "usehooks-ts";

import { EquipmentRow } from "./equipment-row";

const ESTIMATED_ROW_HEIGHT = 68;
const ROW_OVERSCAN = 12;
const LOAD_MORE_MARGIN = "600px";

export function EquipmentList({
  items,
  settling,
  hasMore,
  isFetchingMore,
  loadMore,
  onOpen,
}: {
  items: EquipmentItem[];
  settling: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  onOpen: (id: string) => void;
}) {
  "use no memo";

  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const { height: windowHeight } = useWindowSize();
  const isEmpty = items.length === 0;

  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY);
  }, [windowHeight, isEmpty]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
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

  useEffect(() => {
    if (atEnd && hasMore && !isFetchingMore) loadMore();
  }, [atEnd, hasMore, isFetchingMore, items.length, loadMore]);

  return (
    <div ref={containerRef} className="flex flex-col">
      <div
        className={`border-border relative overflow-hidden rounded-xl border transition-opacity ${settling ? "opacity-60" : ""}`}
        data-testid="equipment-list"
        role="list"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualRows.map((virtualRow) => {
          const item = items[virtualRow.index];

          if (!item) return null;

          return (
            <div
              key={item.id}
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
              <EquipmentRow item={item} onOpen={onOpen} />
            </div>
          );
        })}
      </div>
      <div ref={endRef} aria-hidden data-testid="equipment-list-end" />
      {isFetchingMore ? (
        <div className="flex justify-center py-4" data-testid="equipment-load-more">
          <Spinner color="accent" size="sm" />
        </div>
      ) : null}
    </div>
  );
}
