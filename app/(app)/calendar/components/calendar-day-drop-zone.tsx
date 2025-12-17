"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

type CalendarDayDropZoneProps = {
  date: string;
  children: React.ReactNode;
  onDrop?: (date: string) => void;
  isDraggingItem: boolean;
  draggedItemDate: string | null;
};

export function CalendarDayDropZone({
  date,
  children,
  onDrop,
  isDraggingItem,
  draggedItemDate,
}: CalendarDayDropZoneProps) {
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingItem || !dropZoneRef.current) return;

      const rect = dropZoneRef.current.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      setIsHovering(isInside);
    },
    [isDraggingItem]
  );

  const handlePointerUp = useCallback(() => {
    if (isHovering && isDraggingItem && draggedItemDate !== date) {
      onDrop?.(date);
    }
    setIsHovering(false);
  }, [isHovering, isDraggingItem, draggedItemDate, date, onDrop]);

  useEffect(() => {
    if (!isDraggingItem) {
      setIsHovering(false);

      return;
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingItem, handlePointerMove, handlePointerUp]);

  const isSameDate = draggedItemDate === date;

  return (
    <motion.div
      ref={dropZoneRef}
      animate={{
        scale: isHovering && !isSameDate ? 0.98 : 1,
      }}
      className="relative"
      transition={{ duration: 0.15 }}
    >
      {children}

      <AnimatePresence>
        {isHovering && !isSameDate && (
          <motion.div
            animate={{ opacity: 1 }}
            className="border-primary pointer-events-none absolute inset-0 z-10 rounded-md border-2"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            style={{
              boxShadow: "0 0 0 4px rgba(var(--heroui-primary-rgb), 0.1)",
            }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
