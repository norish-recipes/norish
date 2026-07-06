import type {
  ContainerId,
  DndGroupedGroceryProviderProps,
  GroupItemsState,
} from "@/components/groceries/dnd/types";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMultiContainerCollisionDetection } from "@/components/groceries/dnd/collision-detection";
import {
  buildGroupItemsState,
  containerIdToStoreId,
  findContainerForGroup,
} from "@/components/groceries/dnd/utils";
import { arrayMove } from "@dnd-kit/sortable";

import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

interface UseGroupedGroceryDndResult {
  // State
  activeGroupKey: string | null;
  activeGroup: GroceryGroup | null;
  overContainerId: ContainerId | null;
  groupItems: GroupItemsState;

  // Collision detection
  collisionDetection: CollisionDetection;

  // Handlers
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;

  // Helpers
  getGroupKeysForContainer: (containerId: ContainerId) => string[];
}

export function useGroupedGroceryDnd({
  stores,
  groupedGroceries,
  onReorderGroups,
}: Omit<DndGroupedGroceryProviderProps, "children">): UseGroupedGroceryDndResult {
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<ContainerId | null>(null);

  // Group items state: container ID -> array of group keys
  // This updates during drag to reflect visual state
  const [groupItems, setGroupItems] = useState<GroupItemsState>(() =>
    buildGroupItemsState(groupedGroceries, stores)
  );

  // Clone of groupItems at drag start - used for cancel recovery
  const clonedGroupItems = useRef<GroupItemsState | null>(null);

  // Refs for stable collision detection (from reference implementation)
  const lastOverId = useRef<string | null>(null);
  const recentlyMovedToNewContainer = useRef(false);

  // Build a map of groupKey -> GroceryGroup for quick lookup
  const groupMap = useMemo(() => {
    const map = new Map<string, GroceryGroup>();

    for (const groups of groupedGroceries.values()) {
      for (const group of groups) {
        map.set(group.groupKey, group);
      }
    }

    return map;
  }, [groupedGroceries]);

  // Sync groupItems when groupedGroceries/stores change externally
  const prevGroupedGroceriesRef = useRef<Map<string | null, GroceryGroup[]>>(groupedGroceries);

  // Only rebuild if we're not actively dragging and groupedGroceries changed
  if (!activeGroupKey && groupedGroceries !== prevGroupedGroceriesRef.current) {
    prevGroupedGroceriesRef.current = groupedGroceries;
    const newGroupItems = buildGroupItemsState(groupedGroceries, stores);
    const itemsChanged =
      JSON.stringify(Object.keys(newGroupItems).sort()) !==
        JSON.stringify(Object.keys(groupItems).sort()) ||
      Object.keys(newGroupItems).some(
        (key) => JSON.stringify(newGroupItems[key]) !== JSON.stringify(groupItems[key])
      );

    if (itemsChanged) {
      setGroupItems(newGroupItems);
    }
  }

  // Reset recentlyMovedToNewContainer after groupItems state settles
  useEffect(() => {
    requestAnimationFrame(() => {
      recentlyMovedToNewContainer.current = false;
    });
  }, [groupItems]);

  const collisionDetection = useMemo(
    () =>
      createMultiContainerCollisionDetection(
        groupItems,
        activeGroupKey,
        lastOverId,
        recentlyMovedToNewContainer
      ),
    [groupItems, activeGroupKey]
  );

  const activeGroup = useMemo(() => {
    if (!activeGroupKey) return null;

    return groupMap.get(activeGroupKey) ?? null;
  }, [activeGroupKey, groupMap]);

  const getGroupKeysForContainer = useCallback(
    (containerId: ContainerId): string[] => {
      return groupItems[containerId] ?? [];
    },
    [groupItems]
  );

  const findContainer = useCallback(
    (id: string): ContainerId | undefined => {
      // Check if id is a container itself
      if (id in groupItems) {
        return id;
      }

      // Find which container has this group
      return Object.keys(groupItems).find((key) => groupItems[key].includes(id));
    },
    [groupItems]
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const groupKey = active.id as string;

      setActiveGroupKey(groupKey);
      // Clone current groupItems for cancel recovery
      clonedGroupItems.current = JSON.parse(JSON.stringify(groupItems));

      const containerId = findContainerForGroup(groupKey, groupItems);

      setOverContainerId(containerId);
    },
    [groupItems]
  );

  const handleDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const overId = over?.id;

      if (overId == null || active.id === overId) {
        return;
      }

      const overContainer = findContainer(overId as string);
      const activeContainer = findContainer(active.id as string);

      if (!overContainer || !activeContainer) {
        return;
      }

      setOverContainerId(overContainer);

      if (activeContainer !== overContainer) {
        setGroupItems((prevItems) => {
          const activeItems = prevItems[activeContainer];
          const overItems = prevItems[overContainer];
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
            [activeContainer]: prevItems[activeContainer].filter((key) => key !== active.id),
            [overContainer]: [
              ...overItems.slice(0, newIndex),
              movingItem,
              ...overItems.slice(newIndex),
            ],
          };
        });
      } else {
        setGroupItems((prevItems) => {
          const containerItems = prevItems[activeContainer] ?? [];
          const activeIndex = containerItems.indexOf(active.id as string);
          const overIndex = containerItems.indexOf(overId as string);

          if (activeIndex >= 0 && overIndex >= 0 && activeIndex !== overIndex) {
            return {
              ...prevItems,
              [activeContainer]: arrayMove(containerItems, activeIndex, overIndex),
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
      const originalGroupItems = clonedGroupItems.current;
      const currentContainer = findContainer(active.id as string);

      if (!currentContainer) {
        setActiveGroupKey(null);
        setOverContainerId(null);
        clonedGroupItems.current = null;

        return;
      }

      const overId = over?.id;

      if (overId == null) {
        // No valid drop - restore original
        if (originalGroupItems) {
          setGroupItems(originalGroupItems);
        }
        setActiveGroupKey(null);
        setOverContainerId(null);
        clonedGroupItems.current = null;

        return;
      }

      if (originalGroupItems) {
        const originalContainer = findContainerForGroup(active.id as string, originalGroupItems);
        const wasCrossContainerMove = originalContainer !== currentContainer;

        const updates: { id: string; sortOrder: number; storeId?: string | null }[] = [];

        if (wasCrossContainerMove && originalContainer) {
          const currentOriginalGroups = groupItems[originalContainer] ?? [];

          currentOriginalGroups.forEach((groupKey, groupIndex) => {
            const group = groupMap.get(groupKey);

            group?.sources.forEach((source) => {
              updates.push({ id: source.grocery.id, sortOrder: groupIndex });
            });
          });
        }

        const newStoreId = containerIdToStoreId(currentContainer);
        const finalGroups = groupItems[currentContainer] ?? [];

        finalGroups.forEach((groupKey, groupIndex) => {
          const group = groupMap.get(groupKey);

          group?.sources.forEach((source) => {
            const update: { id: string; sortOrder: number; storeId?: string | null } = {
              id: source.grocery.id,
              sortOrder: groupIndex,
            };

            if (wasCrossContainerMove && groupKey === active.id) {
              update.storeId = newStoreId;
            }

            updates.push(update);
          });
        });

        const updateMap = new Map<
          string,
          { id: string; sortOrder: number; storeId?: string | null }
        >();

        for (const update of updates) {
          const existing = updateMap.get(update.id);

          if (!existing || update.storeId !== undefined) {
            updateMap.set(update.id, update);
          }
        }

        if (updateMap.size > 0) {
          onReorderGroups(Array.from(updateMap.values()));
        }
      }

      setActiveGroupKey(null);
      setOverContainerId(null);
      clonedGroupItems.current = null;
    },
    [findContainer, groupItems, groupMap, onReorderGroups]
  );

  const handleDragCancel = useCallback(() => {
    if (clonedGroupItems.current) {
      setGroupItems(clonedGroupItems.current);
    }
    setActiveGroupKey(null);
    setOverContainerId(null);
    clonedGroupItems.current = null;
  }, []);

  return {
    activeGroupKey,
    activeGroup,
    overContainerId,
    groupItems,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    getGroupKeysForContainer,
  };
}
