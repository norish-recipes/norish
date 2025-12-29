"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

type StoreDropZoneProps = {
  storeId: string | null;
  children: React.ReactNode;
  onDrop?: (storeId: string | null) => void;
  onDropWithinStore?: (dropY: number) => void;
  isDraggingItem: boolean;
  draggedItemStoreId: string | null | undefined;
};

export function StoreDropZone({
  storeId,
  children,
  onDrop,
  onDropWithinStore,
  isDraggingItem,
  draggedItemStoreId,
}: StoreDropZoneProps) {
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

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (isHovering && isDraggingItem) {
      if (draggedItemStoreId !== storeId) {
        // Moving to different store
        onDrop?.(storeId);
      } else {
        // Dropping within same store - pass Y position for reordering
        onDropWithinStore?.(e.clientY);
      }
    }
    setIsHovering(false);
  }, [isHovering, isDraggingItem, draggedItemStoreId, storeId, onDrop, onDropWithinStore]);

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

  const isSameStore = draggedItemStoreId === storeId;

  return (
    <motion.div
      ref={dropZoneRef}
      animate={{
        scale: isHovering && !isSameStore ? 0.98 : 1,
      }}
      className="relative"
      transition={{ duration: 0.15 }}
    >
      {children}

      <AnimatePresence>
        {isHovering && !isSameStore && (
          <motion.div
            animate={{ opacity: 1 }}
            className="border-primary pointer-events-none absolute inset-0 z-10 rounded-xl border-2"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
