"use client";

import type { GroceryGroup } from "@/lib/grocery-grouping";
import type { GroupDragHandle } from "./types";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon } from "@heroicons/react/16/solid";

interface SortableGroupItemProps {
  group: GroceryGroup;
  children: GroupDragHandle;
}

/** Wraps a grouped grocery item with dnd-kit sortable. Shows ghost placeholder while dragging. */
export function SortableGroupItem({ group, children }: SortableGroupItemProps) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: group.groupKey,
    data: {
      type: "group",
      group,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      className="text-default-400 flex h-8 w-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      type="button"
      {...attributes}
      {...listeners}
    >
      <Bars3Icon className="h-5 w-5" />
    </button>
  );

  return (
    <div ref={setNodeRef} className="relative" style={style}>
      {/* The actual grouped grocery item content */}
      {children({ dragHandle })}
    </div>
  );
}
