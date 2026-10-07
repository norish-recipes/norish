"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon } from "@heroicons/react/16/solid";

import type { GroceryDto } from "@norish/shared/contracts";

/** A sortable row: a touch's long press must neither select its text nor open the callout. */
export const ROW_CLASS_NAME =
  "relative touch-pan-y pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]";

interface SortableGroceryItemProps {
  grocery: GroceryDto;
  children: ReactNode;
}

/** Wraps a grocery item with dnd-kit sortable. Shows ghost placeholder while dragging. */
export function SortableGroceryItem({ grocery, children }: SortableGroceryItemProps) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: grocery.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    // A finger picks the row up anywhere with a long press, as it does a meal
    // on the calendar; the handle is for a pointer, and a phone has no room for it.
    <div
      ref={setNodeRef}
      className={ROW_CLASS_NAME}
      style={style}
      onTouchStart={listeners?.onTouchStart}
    >
      {/* Drag handle - positioned absolutely on the left */}
      <button
        ref={setActivatorNodeRef}
        className="absolute top-1/2 left-2 z-10 flex h-8 w-8 -translate-y-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing max-sm:hidden"
        type="button"
        {...attributes}
        {...listeners}
      >
        <Bars3Icon className="text-muted/60 h-4 w-4" />
      </button>

      {/* The actual grocery item content */}
      {children}
    </div>
  );
}
