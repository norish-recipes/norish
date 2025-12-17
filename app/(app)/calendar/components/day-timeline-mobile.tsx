"use client";

import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useCallback } from "react";
import { Virtuoso } from "react-virtuoso";

import { useDayTimelineShared } from "./use-day-timeline-shared";

export default function DayTimelineMobile() {
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

  const virtuosoRef = useRef<any>(null);

  const scrollToToday = useCallback(() => {
    if (todayIndex >= 0) {
      setTodayVisible(true);
      virtuosoRef.current?.scrollToIndex({
        index: todayIndex,
        behavior: "smooth",
      });
    }
  }, [todayIndex, setTodayVisible]);

  const handleRangeChanged = useCallback(
    ({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
      if (todayIndex < 0) return;
      const visible = startIndex <= todayIndex && todayIndex <= endIndex;

      setTodayVisible(visible);

      if (!visible) {
        if (todayIndex < startIndex) setArrowDir("up");
        else if (todayIndex > endIndex) setArrowDir("down");
      }
    },
    [todayIndex, setTodayVisible, setArrowDir]
  );

  if (isLoading) return <LoadingSkeleton />;
  if (allDays.length === 0) return <EmptyState />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <Virtuoso
        ref={virtuosoRef}
        useWindowScroll
        data={allDays}
        initialTopMostItemIndex={Math.max(todayIndex, 0)}
        itemContent={(_, d) => renderDayContent(d)}
        rangeChanged={handleRangeChanged}
      />

      <AnimatePresence>
        {!todayVisible && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed right-6 z-20"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)" }}
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
