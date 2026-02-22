"use client";

import type { ReactNode } from "react";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import type { ContainerId } from "./types";

import {
  useSortable,
  defaultAnimateLayoutChanges,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { useDndGroupedGroceryContext } from "./dnd-grouped-grocery-provider";
import { UNSORTED_CONTAINER } from "./types";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableGroupedStoreContainerProps {
  storeId: string | null; // null = unsorted
  /** Content to render inside the sortable area (the grouped grocery items) */
  children: ReactNode;
  /** Header element to render - will be part of the droppable area */
  header?: ReactNode;
  /** Background class for the header */
  headerBgClass?: string;
}

/** Wraps a grouped store section as a droppable container. Uses useSortable for proper drag detection. */
export function SortableGroupedStoreContainer({
  storeId,
  children,
  header,
  headerBgClass = "",
}: SortableGroupedStoreContainerProps) {
  const containerId: ContainerId = storeId ?? UNSORTED_CONTAINER;

  // Get group keys from DnD context - this updates during drag
  const { getGroupKeysForContainer, overContainerId, activeGroupKey } =
    useDndGroupedGroceryContext();
  const groupKeys = getGroupKeysForContainer(containerId);

  // Use useSortable for containers (like reference implementation)
  // This makes the whole container (including header) a valid drop target
  const { active, over, setNodeRef, transition } = useSortable({
    id: containerId,
    data: {
      type: "container",
      children: groupKeys,
    },
    animateLayoutChanges,
  });

  // Determine if we're hovering over this container
  const isOverContainer = over
    ? (containerId === over.id && active?.data.current?.type !== "container") ||
      groupKeys.includes(over.id as string)
    : false;

  // Show visual indicator when dragging over this container
  const showDropIndicator =
    activeGroupKey !== null && (overContainerId === containerId || isOverContainer);

  return (
    <div
      ref={setNodeRef}
      className={`overflow-hidden rounded-xl transition-all duration-200 ${
        showDropIndicator ? "ring-primary ring-2" : ""
      }`}
      data-is-over={isOverContainer}
      data-store-id={containerId}
      style={{
        transition,
        // Don't transform containers, only their items
      }}
    >
      {/* Header is part of the droppable area */}
      {header && <div className={headerBgClass}>{header}</div>}

      {/* Groups area with sortable context */}
      <SortableContext items={groupKeys} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}
