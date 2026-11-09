"use client";

import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import {
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { aisleContainerId } from "./utils";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableAisleContainerProps {
  aisleId: string;
  /** The keys under this aisle now — rows or groups — in the order the drag has them. */
  itemIds: string[];
  /** Whether a drag is on, and which container it is over. */
  activeId: string | null;
  overContainerId: string | null;
  /** The aisle's heading: part of the droppable, so an empty aisle can still be dropped into. */
  header: ReactNode;
  children: ReactNode;
}

/**
 * One aisle of a Store's block as a droppable of its own, inside the Store's:
 * its heading and whatever is filed under it. It is always rendered, so an
 * empty aisle is a place to drag a row without any drag-time layout change.
 */
export function SortableAisleContainer({
  aisleId,
  itemIds,
  activeId,
  overContainerId,
  header,
  children,
}: SortableAisleContainerProps) {
  const containerId = aisleContainerId(aisleId);
  const { active, over, setNodeRef, transition } = useSortable({
    id: containerId,
    data: { type: "container", children: itemIds },
    animateLayoutChanges,
  });
  const isOverContainer = over
    ? (containerId === over.id && active?.data.current?.type !== "container") ||
      itemIds.includes(over.id as string)
    : false;
  const showDropIndicator =
    activeId !== null && (overContainerId === containerId || isOverContainer);

  return (
    <div
      ref={setNodeRef}
      className={`divide-border divide-y transition-shadow duration-200 ${
        showDropIndicator ? "ring-accent rounded-lg ring-2 ring-inset" : ""
      }`}
      data-aisle-id={aisleId}
      data-is-over={isOverContainer}
      style={{ transition }}
    >
      {header}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}
