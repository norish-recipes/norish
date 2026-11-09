"use client";

import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { memo } from "react";
import {
  defaultAnimateLayoutChanges,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { AisleDto } from "@norish/shared/contracts";

import { AisleHeading } from "../aisle-heading";
import { aisleContainerId } from "./utils";

// Always animate layout changes, including after drag
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

interface SortableAisleContainerProps<T> {
  aisle: AisleDto;
  /** What is filed under it now, rows or groups, in the order the drag has them. */
  rows: readonly T[];
  /** The keys of `rows`. */
  itemIds: string[];
  /** Whether a drag is on, and which container it is over. */
  activeId: string | null;
  overContainerId: string | null;
  /** One function for every aisle of a Store, so an aisle whose rows are unchanged does not render. */
  renderRow: (row: T) => ReactNode;
}

/**
 * One aisle of a Store's block as a droppable of its own, inside the Store's:
 * its heading and whatever is filed under it. It is always rendered, so an
 * empty aisle is a place to drag a row without any drag-time layout change.
 */
function SortableAisleContainerComponent<T>({
  aisle,
  rows,
  itemIds,
  activeId,
  overContainerId,
  renderRow,
}: SortableAisleContainerProps<T>) {
  const containerId = aisleContainerId(aisle.id);
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
      data-aisle-id={aisle.id}
      data-is-over={isOverContainer}
      style={{ transition }}
    >
      {/* The heading is part of the droppable, so an empty aisle can still be dropped into */}
      <AisleHeading aisleId={aisle.id} count={rows.length} name={aisle.name} />
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        {rows.map(renderRow)}
      </SortableContext>
    </div>
  );
}

// memo drops the type parameter, so the export puts it back.
export const SortableAisleContainer = memo(
  SortableAisleContainerComponent
) as typeof SortableAisleContainerComponent;
