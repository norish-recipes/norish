"use client";

import type { GroceryDto } from "@/types";

import { ReactNode, useCallback, useRef } from "react";
import { Reorder, useDragControls } from "motion/react";
import { Bars3Icon } from "@heroicons/react/16/solid";

interface DraggableGroceryStoreItemProps {
  grocery: GroceryDto;
  children: ReactNode;
  onDragStart?: (groceryId: string) => void;
  onDragEnd?: (pointerPosition: { x: number; y: number }) => void;
}

export function DraggableGroceryStoreItem({
  grocery,
  children,
  onDragStart,
  onDragEnd,
}: DraggableGroceryStoreItemProps) {
  const controls = useDragControls();
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback(() => {
    onDragStart?.(grocery.id);
  }, [grocery.id, onDragStart]);

  const handleDragEnd = useCallback(() => {
    onDragEnd?.(lastPointerRef.current);
  }, [onDragEnd]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    
    // Track pointer during drag
    const handlePointerMove = (ev: PointerEvent) => {
      lastPointerRef.current = { x: ev.clientX, y: ev.clientY };
    };
    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    
    controls.start(e);
  }, [controls]);

  return (
    <Reorder.Item
      className="relative"
      drag="y"
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{ position: "relative", zIndex: 1 }}
      value={grocery}
      whileDrag={{ zIndex: 100, position: "relative" }}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
    >
      {/* Drag handle overlay */}
      <div
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
        onPointerDown={handlePointerDown}
      >
        <Bars3Icon className="text-default-400 h-5 w-5" />
      </div>

      {/* The actual grocery item content */}
      <div className="relative">{children}</div>
    </Reorder.Item>
  );
}
