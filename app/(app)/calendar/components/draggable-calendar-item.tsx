"use client";

import { motion, useDragControls, PanInfo, useMotionValue } from "motion/react";
import { useRef, useState, useCallback } from "react";

import { CalendarItemViewDto } from "@/types";

type DraggableCalendarItemProps = {
  item: CalendarItemViewDto;
  children: React.ReactNode;
  onDragStart?: (itemId: string, currentDate: string) => void;
  onDragEnd?: (itemId: string, currentDate: string, info: PanInfo) => void;
  isDraggingAny: boolean;
};

const LONG_PRESS_DURATION = 300; // In ms
const MOVEMENT_THRESHOLD = 10; // In px

export function DraggableCalendarItem({
  item,
  children,
  onDragStart,
  onDragEnd,
  isDraggingAny,
}: DraggableCalendarItemProps) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pressEventRef = useRef<PointerEvent | null>(null);
  const y = useMotionValue(0);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (containerRef.current) {
      containerRef.current.style.touchAction = "";
    }
    startPositionRef.current = null;
    pressEventRef.current = null;
    setIsReady(false);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      startPositionRef.current = { x: e.clientX, y: e.clientY };
      pressEventRef.current = e.nativeEvent as PointerEvent;

      longPressTimerRef.current = window.setTimeout(() => {
        setIsReady(true);
        if (containerRef.current) {
          containerRef.current.style.touchAction = "none";
        }

        // Use the stored native PointerEvent to avoid relying on a stale React event
        if (pressEventRef.current) {
          dragControls.start(pressEventRef.current as any);
        }
        longPressTimerRef.current = null;
      }, LONG_PRESS_DURATION);
    },
    [dragControls]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (longPressTimerRef.current && startPositionRef.current) {
        const dx = Math.abs(e.clientX - startPositionRef.current.x);
        const dy = Math.abs(e.clientY - startPositionRef.current.y);

        // Cancel if movement exceeds threshold
        if (dx > MOVEMENT_THRESHOLD || dy > MOVEMENT_THRESHOLD) {
          cancelLongPress();
        }
      }
    },
    [cancelLongPress]
  );

  const handlePointerUp = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    onDragStart?.(item.id, item.date);
  }, [item.id, item.date, onDragStart]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      setIsReady(false);

      if (containerRef.current) {
        containerRef.current.style.touchAction = "";
      }

      onDragEnd?.(item.id, item.date, info);
    },
    [item.id, item.date, onDragEnd]
  );

  return (
    <motion.div
      ref={containerRef}
      animate={{
        scale: isDragging ? 1.05 : isReady ? 1.03 : 1,
        opacity: isDraggingAny && !isDragging ? 0.5 : 1,
      }}
      className="relative touch-none select-none"
      drag="y"
      dragControls={dragControls}
      dragDirectionLock={true}
      dragElastic={0.05}
      dragListener={false}
      dragMomentum={false}
      dragSnapToOrigin={true}
      style={{
        y,
        zIndex: isDragging ? 50 : 1,
        cursor: isDragging ? "grabbing" : "default",
      }}
      transition={{
        scale: {
          duration: isDragging ? 0.15 : 0.2,
          type: "spring",
          stiffness: 300,
          damping: 25,
        },
        opacity: { duration: 0.2 },
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Wrapper to block pointer events during drag */}
      <div style={{ pointerEvents: isDragging || isReady ? "none" : "auto" }}>{children}</div>

      {/* Drag Preview */}
      {isDragging && (
        <div
          className="bg-content1 pointer-events-none absolute inset-0 rounded-md opacity-90 shadow-xl"
          style={{ zIndex: -1 }}
        />
      )}
    </motion.div>
  );
}
