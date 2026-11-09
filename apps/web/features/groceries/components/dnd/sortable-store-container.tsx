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
import { useDndGroceryContext } from "./dnd-grocery-provider";
import { UNSORTED_CONTAINER } from "./types";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableStoreContainerProps {
  storeId: string | null; // null = unsorted
  /** The heading bar at the top of the card; part of the droppable, so a collapsed or empty Store still takes a drop. */
  header: ReactNode;
  /** The rows under the heading, or null where the card is its heading bar alone. */
  children: ReactNode | null;
}

/**
 * One Store's section as a droppable: one card, its heading bar on top and,
 * where there is anything to show, the rows beneath it. Nothing is added to
 * or taken from the page when a drag starts, and while a drag is over the
 * section the card takes the accent ring, rows or no rows, so a collapsed or
 * empty Store still says it will take the row.
 */
export function SortableStoreContainer({ storeId, header, children }: SortableStoreContainerProps) {
  const containerId: ContainerId = storeId ?? UNSORTED_CONTAINER;

  // Get items from DnD context - this updates during drag
  const { getItemsForContainer, overContainerId, activeId } = useDndGroceryContext();
  const itemIds = getItemsForContainer(containerId);

  // The whole section, heading included, is the drop target
  const { active, over, setNodeRef, transition } = useSortable({
    id: containerId,
    data: {
      type: "container",
      children: itemIds,
    },
    animateLayoutChanges,
  });

  // Determine if we're hovering over this container
  const isOverContainer = over
    ? (containerId === over.id && active?.data.current?.type !== "container") ||
      itemIds.includes(over.id as string)
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
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
