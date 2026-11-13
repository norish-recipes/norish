"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon } from "@heroicons/react/16/solid";

import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import type { GroupRow } from "./types";
import { drawsTheSame } from "../grouped-grocery-item";
import { ROW_CLASS_NAME } from "./sortable-grocery-item";

interface SortableGroupItemProps {
  group: GroceryGroup;
  isFirst: boolean;
  isLast: boolean;
  /** One function for every row of a Store, so a row whose group is unchanged does not render. */
  row: GroupRow;
}

/**
 * Wraps a grouped grocery item with dnd-kit sortable. Shows ghost placeholder while dragging.
 * It skips what its row skips, so a group's new sort order or version renders neither.
 */
export const SortableGroupItem = memo(function SortableGroupItem({
  group,
  isFirst,
  isLast,
  row,
}: SortableGroupItemProps) {
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
      className="text-muted/60 flex h-8 w-8 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      type="button"
      {...attributes}
      {...listeners}
    >
      <Bars3Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      className={ROW_CLASS_NAME}
      style={style}
      onTouchStart={(event) => listeners?.onTouchStart?.(event)}
    >
      {row(group, { dragHandle, isFirst, isLast })}
    </div>
  );
}, drawsTheSame);
