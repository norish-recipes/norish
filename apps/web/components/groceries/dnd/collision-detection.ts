import type { CollisionDetection, UniqueIdentifier } from "@dnd-kit/core";
import type { RefObject } from "react";
import type { ItemsState } from "./types";

import { closestCenter, pointerWithin, rectIntersection, getFirstCollision } from "@dnd-kit/core";

/**
 * Custom collision detection for multiple containers (based on dnd-kit example).
 * Strategy: pointer intersection -> rect intersection -> last known position.
 */
export function createMultiContainerCollisionDetection(
  items: ItemsState,
  activeId: UniqueIdentifier | null,
  lastOverId: RefObject<UniqueIdentifier | null>,
  recentlyMovedToNewContainer: RefObject<boolean>
): CollisionDetection {
  return (args) => {
    // Start by finding any intersecting droppable using pointer position
    const pointerIntersections = pointerWithin(args);
    const intersections =
      pointerIntersections.length > 0
        ? // If there are droppables intersecting with the pointer, return those
          pointerIntersections
        : rectIntersection(args);

    let overId = getFirstCollision(intersections, "id");

    if (overId != null) {
      // If we're over a container (not an item)
      if (overId in items) {
        const containerItems = items[overId];

        // If the container has items, find the closest item within it
        if (containerItems.length > 0) {
          // Return the closest droppable within that container
          const closestItem = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                container.id !== overId && containerItems.includes(container.id as string)
            ),
          })[0]?.id;

          if (closestItem) {
            overId = closestItem;
          }
        }
      }

      lastOverId.current = overId;

      return [{ id: overId }];
    }

    // When a draggable item moves to a new container, the layout may shift
    // and the `overId` may become `null`. We manually set the cached `lastOverId`
    // to the id of the draggable item that was moved to the new container
    if (recentlyMovedToNewContainer.current) {
      lastOverId.current = activeId;
    }

    // If no droppable is matched, return the last match
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  };
}
