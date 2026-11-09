"use client";

import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import {
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { ContainerId } from "./types";
import { UNSORTED_CONTAINER } from "./types";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableGroupedStoreContainerProps {
  storeId: string | null; // null = unsorted
  /** The group keys in the Store's own unfiled area, in the order the drag has them. */
  itemIds: string[];
  /** Whether a drag is on, and which container it is over. */
  activeId: string | null;
  overContainerId: string | null;
  /** The heading bar at the top of the card; part of the droppable, so a collapsed or empty Store still takes a drop. */
  header: ReactNode;
  /** The groups under the heading, or null where the card is its heading bar alone. */
  children: ReactNode | null;
}

/**
 * The grouped list's counterpart of SortableStoreContainer: one Store's
 * section as one card, its heading bar on top and the groups beneath it
 * where there is anything to show, with the same drop feedback.
 */
export function SortableGroupedStoreContainer({
  storeId,
  itemIds: groupKeys,
  activeId,
  overContainerId,
  header,
  children,
}: SortableGroupedStoreContainerProps) {
  const containerId: ContainerId = storeId ?? UNSORTED_CONTAINER;

  // The whole section, heading included, is the drop target
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
    activeId !== null && (overContainerId === containerId || isOverContainer);
  const hasRows = children !== null;

  return (
    <div
      ref={setNodeRef}
      className={`border-border bg-surface shadow-surface overflow-hidden rounded-xl border transition-shadow duration-200 ${
        showDropIndicator ? "ring-accent ring-2" : ""
      }`}
      data-is-over={isOverContainer}
      data-store-id={containerId}
      data-testid="store-card"
      style={{
        transition,
        // Don't transform containers, only their items
      }}
    >
      {/* The heading bar; a drop on it lands in the Store, rows or no rows */}
      <div className="bg-surface-secondary">{header}</div>

      {hasRows && (
        <div className="border-border border-t" data-testid="store-rows">
          <SortableContext items={groupKeys} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
