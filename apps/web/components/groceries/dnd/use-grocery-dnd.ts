import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import type { ContainerId, DndGroceryProviderProps, ItemsState } from "./types";
import { createMultiContainerCollisionDetection } from "./collision-detection";
import { planDrop } from "./drop-plan";
import { buildItemsState, findContainerForItem } from "./utils";

interface UseGroceryDndResult {
  // State
  activeId: string | null;
  activeGrocery: GroceryDto | null;
  activeRecurringGrocery: RecurringGroceryDto | null;
  activeRecipeName: string | null;
  overContainerId: ContainerId | null;
  items: ItemsState;

  // Collision detection
  collisionDetection: CollisionDetection;

  // Handlers
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;

  // Helpers
  getItemsForContainer: (containerId: ContainerId) => string[];
}

export function useGroceryDnd({
  groceries,
  stores,
  recurringGroceries,
  onReorderInStore,
  aisleFor,
  onFileName,
  getRecipeNameForGrocery,
}: Omit<DndGroceryProviderProps, "children">): UseGroceryDndResult {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<ContainerId | null>(null);
  const [items, setItems] = useState<ItemsState>(() =>
    buildItemsState(groceries, stores, aisleFor)
  );
  const clonedItems = useRef<ItemsState | null>(null);
  const lastOverId = useRef<string | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  // Sync items state when groceries, stores or filings change from an external
  // source: a housemate's filing moves a row between containers too.
  const source = { groceries, stores, aisleFor };
  const prevSourceRef = useRef(source);

  if (
    !activeId &&
    (groceries !== prevSourceRef.current.groceries ||
      stores !== prevSourceRef.current.stores ||
      aisleFor !== prevSourceRef.current.aisleFor)
  ) {
    prevSourceRef.current = source;
    const newItems = buildItemsState(groceries, stores, aisleFor);
    const itemsChanged =
      JSON.stringify(Object.keys(newItems).sort()) !== JSON.stringify(Object.keys(items).sort()) ||
      Object.keys(newItems).some(
        (key) => JSON.stringify(newItems[key]) !== JSON.stringify(items[key])
      );

    if (itemsChanged) {
      setItems(newItems);
    }
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [items]);

  const collisionDetection = useMemo(
    () =>
      createMultiContainerCollisionDetection(
        items,
        activeId,
        lastOverId,
        recentlyMovedToNewContainer
      ),
    [items, activeId]
  );

  const activeGrocery = useMemo(() => {
    if (!activeId) return null;

    return groceries.find((g) => g.id === activeId) ?? null;
  }, [activeId, groceries]);

  const activeRecurringGrocery = useMemo(() => {
    if (!activeGrocery?.recurringGroceryId) return null;

    return recurringGroceries.find((r) => r.id === activeGrocery.recurringGroceryId) ?? null;
  }, [activeGrocery, recurringGroceries]);

  const activeRecipeName = useMemo(() => {
    if (!activeGrocery || !getRecipeNameForGrocery) return null;

    return getRecipeNameForGrocery(activeGrocery);
  }, [activeGrocery, getRecipeNameForGrocery]);

  const getItemsForContainer = useCallback(
    (containerId: ContainerId): string[] => {
      return items[containerId] ?? [];
    },
    [items]
  );

  const findContainer = useCallback(
    (id: string): ContainerId | undefined => {
      if (id in items) return id;

      return Object.keys(items).find((key) => (items[key] ?? []).includes(id));
    },
    [items]
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const id = active.id as string;

      setActiveId(id);
      clonedItems.current = JSON.parse(JSON.stringify(items));
      const containerId = findContainerForItem(id, items);

      setOverContainerId(containerId);
    },
    [items]
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const overId = over?.id;

      if (overId == null || active.id === overId) return;

      const overContainer = findContainer(overId as string);
      const activeContainer = findContainer(active.id as string);

      if (!overContainer || !activeContainer) return;

      setOverContainerId(overContainer);

      if (activeContainer !== overContainer) {
        setItems((prevItems) => {
          const activeItems = prevItems[activeContainer] ?? [];
          const overItems = prevItems[overContainer] ?? [];
          const overIndex = overItems.indexOf(overId as string);
          const activeIndex = activeItems.indexOf(active.id as string);
          const movingItem = activeItems[activeIndex];

          if (!movingItem) {
            return prevItems;
          }

          let newIndex: number;

          if (overId in prevItems) {
            newIndex = overItems.length;
          } else {
            const isBelowOverItem =
              over &&
              active.rect.current.translated &&
              active.rect.current.translated.top > over.rect.top + over.rect.height;
            const modifier = isBelowOverItem ? 1 : 0;

            newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
          }

          recentlyMovedToNewContainer.current = true;

          return {
            ...prevItems,
            [activeContainer]: (prevItems[activeContainer] ?? []).filter(
              (item) => item !== active.id
            ),
            [overContainer]: [
              ...(prevItems[overContainer] ?? []).slice(0, newIndex),
              movingItem,
              ...(prevItems[overContainer] ?? []).slice(newIndex),
            ],
          };
        });
      } else {
        setItems((prevItems) => {
          const containerItems = prevItems[activeContainer] ?? [];
          const activeIndex = containerItems.indexOf(active.id as string);
          const overIndex = containerItems.indexOf(overId as string);

          if (activeIndex !== overIndex) {
            return {
              ...prevItems,
              [overContainer]: arrayMove(containerItems, activeIndex, overIndex),
            };
          }

          return prevItems;
        });
      }
    },
    [findContainer]
  );

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const originalItems = clonedItems.current;
      const currentContainer = findContainer(active.id as string);

      if (!currentContainer) {
        setActiveId(null);
        setOverContainerId(null);
        clonedItems.current = null;

        return;
      }

      const overId = over?.id;

      if (overId == null) {
        // No valid drop - restore original
        if (originalItems) {
          setItems(originalItems);
        }
        setActiveId(null);
        setOverContainerId(null);
        clonedItems.current = null;

        return;
      }

      // Commit what the drag arranged (handleDragOver already moved the row):
      // the reorder first, then what the drop teaches the Store, in that order.
      const originalContainer = originalItems
        ? findContainerForItem(active.id as string, originalItems)
        : null;
      const moved = groceries.find((grocery) => grocery.id === active.id);

      if (originalContainer && moved) {
        const { updates, filings } = planDrop({
          items,
          originContainer: originalContainer,
          targetContainer: currentContainer,
          stores,
          aisleFor,
          movedIds: [moved.id],
          movedNames: moved.name ? [moved.name] : [],
          idsOf: (id) => [id],
        });

        if (updates.length > 0) onReorderInStore(updates);
        for (const filing of filings) onFileName(filing.storeId, filing.name, filing.aisleId);
      }

      setActiveId(null);
      setOverContainerId(null);
      clonedItems.current = null;
    },
    [findContainer, items, groceries, stores, aisleFor, onReorderInStore, onFileName]
  );

  const handleDragCancel = useCallback(() => {
    if (clonedItems.current) {
      setItems(clonedItems.current);
    }
    setActiveId(null);
    setOverContainerId(null);
    clonedItems.current = null;
  }, []);

  return {
    activeId,
    activeGrocery,
    activeRecurringGrocery,
    activeRecipeName,
    overContainerId,
    items,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    getItemsForContainer,
  };
}
