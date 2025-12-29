"use client";

import { motion, useDragControls, useMotionValue } from "motion/react";
import { useRef, useState, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";

type DraggableGroceryItemProps = {
  groceryId: string;
  children: ReactNode;
  onDragStart?: (groceryId: string) => void;
  onDragEnd?: () => void;
  isDraggingAny: boolean;
};

const LONG_PRESS_DURATION = 0;
const MOVEMENT_THRESHOLD = 0; 

export function DraggableGroceryItem({
  groceryId,
  children,
  onDragStart,
  onDragEnd,
  isDraggingAny,
}: DraggableGroceryItemProps) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pressEventRef = useRef<PointerEvent | null>(null);
  const initialRectRef = useRef<DOMRect | null>(null);
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
      // Ignore if clicking on checkbox or interactive elements
      const target = e.target as HTMLElement;
      if (
        target.closest('input[type="checkbox"]') ||
        target.closest("button") ||
        target.closest('[role="checkbox"]')
      ) {
        return;
      }

      startPositionRef.current = { x: e.clientX, y: e.clientY };
      pressEventRef.current = e.nativeEvent as PointerEvent;
      
      // Store initial position for portal rendering
      if (containerRef.current) {
        initialRectRef.current = containerRef.current.getBoundingClientRect();
      }

      longPressTimerRef.current = window.setTimeout(() => {
        setIsReady(true);
        if (containerRef.current) {
          containerRef.current.style.touchAction = "none";
        }

        if (pressEventRef.current) {
          dragControls.start(pressEventRef.current as unknown as PointerEvent);
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
    onDragStart?.(groceryId);
  }, [groceryId, onDragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsReady(false);
    initialRectRef.current = null;

    if (containerRef.current) {
      containerRef.current.style.touchAction = "";
    }

    onDragEnd?.();
  }, [onDragEnd]);

  // Placeholder shown when item is being dragged (stays in original position)
  const placeholder = isDragging && initialRectRef.current && (
    <div 
      style={{ 
        height: initialRectRef.current.height,
        opacity: 0.3,
      }} 
    />
  );

  // The actual draggable content - rendered in portal when dragging
  const draggableContent = (
    <motion.div
      ref={containerRef}
      animate={{
        scale: isDragging ? 1.02 : isReady ? 1.01 : 1,
        opacity: isDraggingAny && !isDragging ? 0.5 : 1,
      }}
      className="relative select-none"
      drag="y"
      dragControls={dragControls}
      dragDirectionLock={true}
      dragElastic={0.1}
      dragListener={false}
      dragMomentum={false}
      dragSnapToOrigin={!isDragging} // Don't snap while dragging via portal
      style={{
        y,
        ...(isDragging && initialRectRef.current ? {
          position: "fixed" as const,
          top: initialRectRef.current.top,
          left: initialRectRef.current.left,
          width: initialRectRef.current.width,
          zIndex: 9999,
        } : {}),
      }}
      transition={{
        scale: {
          duration: 0.15,
          type: "spring",
          stiffness: 400,
          damping: 30,
        },
        opacity: { duration: 0.15 },
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Block pointer events on children during drag to prevent accidental clicks */}
      <div style={{ pointerEvents: isDragging || isReady ? "none" : "auto" }}>{children}</div>

      {/* Drag shadow effect */}
      {isDragging && (
        <div
          className="bg-content1 pointer-events-none absolute inset-0 rounded-lg opacity-90 shadow-xl"
          style={{ zIndex: -1 }}
        />
      )}
    </motion.div>
  );

  // When dragging, render via portal to escape stacking contexts
  if (isDragging && typeof document !== "undefined") {
    return (
      <>
        {placeholder}
        {createPortal(draggableContent, document.body)}
      </>
    );
  }

  return draggableContent;
}
