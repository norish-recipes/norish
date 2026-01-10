"use client";

import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useCallback, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useDayTimelineShared } from "./use-day-timeline-shared";

import { dateKey } from "@/lib/helpers";

const ESTIMATED_DAY_HEIGHT = 200;

export default function DayTimelineDesktop() {
  const {
    allDays,
    todayIndex,
    todayVisible,
    setTodayVisible,
    arrowDir,
    setArrowDir,
    renderDayContent,
    isLoading,
    EmptyState,
    LoadingSkeleton,
  } = useDayTimelineShared();

  const parentRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToToday, setHasScrolledToToday] = useState(false);

  // Calculate initial offset to start at today
  const initialOffset = todayIndex >= 0 ? todayIndex * ESTIMATED_DAY_HEIGHT : 0;

  const virtualizer = useVirtualizer({
    count: allDays.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_DAY_HEIGHT,
    overscan: 3,
    getItemKey: (index) => dateKey(allDays[index]),
    initialOffset,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Track visible range to show/hide today button
  useEffect(() => {
    if (virtualItems.length === 0 || todayIndex < 0) return;

    const startIndex = virtualItems[0]?.index ?? 0;
    const endIndex = virtualItems[virtualItems.length - 1]?.index ?? 0;

    const visible = startIndex <= todayIndex && todayIndex <= endIndex;

    setTodayVisible(visible);

    if (!visible) {
      if (todayIndex < startIndex) setArrowDir("up");
      else if (todayIndex > endIndex) setArrowDir("down");
    }
  }, [virtualItems, todayIndex, setTodayVisible, setArrowDir]);

  // Scroll to today after first render if measurements are ready
  useEffect(() => {
    if (hasScrolledToToday || todayIndex < 0 || !parentRef.current) return;

    // Wait for DOM to be ready and scroll element to have dimensions
    const timeoutId = setTimeout(() => {
      virtualizer.scrollToIndex(todayIndex, { align: "start" });
      setHasScrolledToToday(true);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [todayIndex, hasScrolledToToday, virtualizer]);

  const scrollToToday = useCallback(() => {
    if (todayIndex >= 0) {
      virtualizer.scrollToIndex(todayIndex, { align: "start", behavior: "smooth" });
    }
  }, [todayIndex, virtualizer]);

  if (isLoading) return <LoadingSkeleton />;
  if (allDays.length === 0) return <EmptyState />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={parentRef} className="absolute inset-0 overflow-auto">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualItem) => {
            const d = allDays[virtualItem.index];

            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderDayContent(d)}
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {!todayVisible && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute right-3 bottom-3 z-20"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
          >
            <Button
              isIconOnly
              color="primary"
              radius="full"
              size="sm"
              variant="solid"
              onPress={scrollToToday}
            >
              {arrowDir === "up" ? (
                <ChevronUpIcon className="h-5 w-5" />
              ) : (
                <ChevronDownIcon className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
