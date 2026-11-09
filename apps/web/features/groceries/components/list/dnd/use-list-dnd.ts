import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";
import { KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import type {
  AisleResolver,
  ContainerId,
  FileGroceryName,
  ItemsState,
  ReorderUpdate,
} from "./types";
import { createMultiContainerCollisionDetection } from "./collision-detection";
import { planDrop } from "./drop-plan";
import { findContainerForItem } from "./utils";

interface ListDndOptions {
  /** Every container's keys as the list holds them now: a row's id, or a group's key. */
  items: ItemsState;
  /** What `items` is built from: a drop's arrangement shows until one of these changes. */
  source: readonly unknown[];
  /** The groceries a key stands for: one row, or a group's lines. */
  linesOf: (key: string) => readonly GroceryDto[];
  stores: StoreDto[];
  aisleFor: AisleResolver;
  onReorder: (updates: ReorderUpdate[]) => void;
  onFileGroceryName: FileGroceryName;
}

/** A drag's arrangement: the keys where it put them, and where the dragged one started. */
interface Arranged {
  items: ItemsState;
  source: readonly unknown[];
  origin: ContainerId | null;
}

/**
 * A drag across the list's Store and aisle containers, for the flat and the grouped list alike.
 * `arranged` holds the drag's keys from its start until the list it was dropped on comes back.
 */
export function useListDnd({
  items,
  source,
  linesOf,
  stores,
  aisleFor,
  onReorder,
  onFileGroceryName,
}: ListDndOptions) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<ContainerId | null>(null);
  const [arranged, setArranged] = useState<Arranged | null>(null);
  const lastOverIdRef = useRef<string | null>(null);
  const recentlyMovedToNewContainerRef = useRef(false);
  const current = arranged?.items ?? items;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // The list a drop wrote came back, or a housemate changed it: the Stores read their own rows again.
  if (
    arranged &&
    activeId === null &&
    source.some((value, index) => value !== arranged.source[index])
  ) {
    setArranged(null);
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainerRef.current = false;
    });
  }, [current]);

  // Built per call rather than once per render: the refs it reads are read
  // mid-drag, never while rendering.
  const collisionDetection: CollisionDetection = (args) =>
    createMultiContainerCollisionDetection(
      current,
      activeId,
      lastOverIdRef,
      recentlyMovedToNewContainerRef
    )(args);

  const findContainer = (id: string): ContainerId | undefined =>
    id in current ? id : Object.keys(current).find((key) => current[key]?.includes(id));

  const handleDragStart = ({ active }: DragStartEvent) => {
    const key = active.id as string;
    const origin = findContainerForItem(key, current);

    setActiveId(key);
    setArranged({ items: current, source, origin });
    setOverContainerId(origin);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const key = active.id as string;
    const overId = over?.id as string | undefined;

    if (overId == null || key === overId) return;

    const overContainer = findContainer(overId);
    const activeContainer = findContainer(key);

    if (!overContainer || !activeContainer) return;

    setOverContainerId(overContainer);
    setArranged((was) => {
      if (!was) return was;
      const activeItems = was.items[activeContainer];
      const overItems = was.items[overContainer];
      const activeIndex = activeItems?.indexOf(key) ?? -1;

      if (!activeItems || !overItems || activeIndex < 0) return was;

      if (activeContainer === overContainer) {
        const overIndex = activeItems.indexOf(overId);

        if (overIndex < 0 || overIndex === activeIndex) return was;

        return {
          ...was,
          items: {
            ...was.items,
            [activeContainer]: arrayMove(activeItems, activeIndex, overIndex),
          },
        };
      }

      const overIndex = overItems.indexOf(overId);
      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height;
      const newIndex =
        overId in was.items || overIndex < 0
          ? overItems.length
          : overIndex + (isBelowOverItem ? 1 : 0);

      recentlyMovedToNewContainerRef.current = true;

      return {
        ...was,
        items: {
          ...was.items,
          [activeContainer]: activeItems.filter((item) => item !== key),
          [overContainer]: [...overItems.slice(0, newIndex), key, ...overItems.slice(newIndex)],
        },
      };
    });
  };

  // Commits what the drag arranged: the reorder first, then what the drop teaches the Store,
  // every distinct name a group holds, since a group behaves as the one thing it looks like.
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const key = active.id as string;
    const target = findContainer(key);
    const origin = arranged?.origin;
    const lines = linesOf(key);
    const { updates, filings } =
      over != null && target && origin && lines.length > 0
        ? planDrop({
            items: current,
            originContainer: origin,
            targetContainer: target,
            stores,
            aisleFor,
            movedIds: lines.map((grocery) => grocery.id),
            movedGroceries: lines,
            idsOf: (other) => linesOf(other).map((grocery) => grocery.id),
          })
        : { updates: [], filings: [] };

    if (updates.length > 0) onReorder(updates);
    for (const filing of filings) onFileGroceryName(filing.storeId, filing.grocery, filing.aisleId);
    // A drop that writes nothing brings no list back, so the Stores read their own rows now.
    if (updates.length === 0 && filings.length === 0) setArranged(null);
    setActiveId(null);
    setOverContainerId(null);
  };

  const handleDragCancel = () => {
    setArranged(null);
    setActiveId(null);
    setOverContainerId(null);
  };

  return {
    activeId,
    overContainerId,
    /** The containers as the drag arranged them, or null while the Stores read their own. */
    arranged: arranged?.items ?? null,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
