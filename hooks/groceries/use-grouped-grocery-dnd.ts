import type { GroceryGroup } from "@/lib/grocery-grouping";
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import type {
  GroupItemsState,
  ContainerId,
  DndGroupedGroceryProviderProps,
} from "@/components/groceries/dnd/types";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

import {
  buildGroupItemsState,
  findContainerForGroup,
  containerIdToStoreId,
} from "@/components/groceries/dnd/utils";
import { createMultiContainerCollisionDetection } from "@/components/groceries/dnd/collision-detection";

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

      // Only handle cross-container moves
      if (activeContainer !== overContainer) {
        setGroupItems((prevItems) => {
          const activeItems = prevItems[activeContainer];
          const overItems = prevItems[overContainer];
          const activeIndex = activeItems.indexOf(active.id as string);

          // Always append to end of target container (no position-based insertion)
          recentlyMovedToNewContainer.current = true;

          return {
            ...prevItems,
            [activeContainer]: prevItems[activeContainer].filter((key) => key !== active.id),
            [overContainer]: [...overItems, activeItems[activeIndex]],
          };
        });
      }
      // Same container: no visual reordering (would be confusing as backend doesn't support it)
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

        if (wasCrossContainerMove) {
          const newStoreId = containerIdToStoreId(currentContainer);
          const movedGroup = groupMap.get(active.id as string);

          if (movedGroup) {
            const updates = movedGroup.sources.map((source) => ({
              id: source.grocery.id,
              sortOrder: source.grocery.sortOrder,
              storeId: newStoreId ?? null,
            }));

            onReorderGroups(updates);
          }
        }
      }

      setActiveGroupKey(null);
      setOverContainerId(null);
      clonedGroupItems.current = null;
    },
    [findContainer, groupMap, onReorderGroups]
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
