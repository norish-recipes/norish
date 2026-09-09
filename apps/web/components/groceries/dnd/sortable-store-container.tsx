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
  /** The heading, on the page ground; part of the droppable, so a collapsed or empty Store still takes a drop. */
  header: ReactNode;
  /** What the card holds, or null where the section is its heading alone. */
  children: ReactNode | null;
}

/**
 * One Store's section as a droppable: its heading on the ground and, where
 * there is anything to show, the card beneath it. Nothing is added to or
 * taken from the page when a drag starts; while a drag is over the section
 * the card takes the accent ring, and a heading with no card under it a soft
 * accent fill, so a collapsed or empty Store still says it will take the row.
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
  const hasCard = children !== null;

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-1.5"
      data-is-over={isOverContainer}
      data-store-id={containerId}
      style={{
        transition,
        // Don't transform containers, only their items
      }}
    >
      <div
        className={`rounded-lg transition-colors duration-200 ${
          showDropIndicator && !hasCard ? "bg-accent-soft" : ""
        }`}
      >
        {header}
      </div>

      {hasCard && (
        <div
          className={`border-border bg-surface shadow-surface overflow-hidden rounded-xl border transition-shadow duration-200 ${
            showDropIndicator ? "ring-accent ring-2" : ""
          }`}
          data-testid="store-card"
        >
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
