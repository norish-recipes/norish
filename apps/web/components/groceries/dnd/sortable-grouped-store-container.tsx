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
import { useDndGroupedGroceryContext } from "./dnd-grouped-grocery-provider";
import { UNSORTED_CONTAINER } from "./types";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableGroupedStoreContainerProps {
  storeId: string | null; // null = unsorted
  /** The heading, on the page ground; part of the droppable, so a collapsed or empty Store still takes a drop. */
  header: ReactNode;
  /** What the card holds, or null where the section is its heading alone. */
  children: ReactNode | null;
}

/**
 * The grouped list's counterpart of SortableStoreContainer: one Store's
 * section as a droppable, its heading on the ground and the card of groups
 * beneath it where there is anything to show, with the same drop feedback.
 */
export function SortableGroupedStoreContainer({
  storeId,
  header,
  children,
}: SortableGroupedStoreContainerProps) {
  const containerId: ContainerId = storeId ?? UNSORTED_CONTAINER;

  // Get group keys from DnD context - this updates during drag
  const { getGroupKeysForContainer, overContainerId, activeGroupKey } =
    useDndGroupedGroceryContext();
  const groupKeys = getGroupKeysForContainer(containerId);

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
    activeGroupKey !== null && (overContainerId === containerId || isOverContainer);
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
          <SortableContext items={groupKeys} strategy={verticalListSortingStrategy}>
            {children}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
