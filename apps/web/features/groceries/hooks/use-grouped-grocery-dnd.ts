import type {
  ContainerId,
  DndGroupedGroceryProviderProps,
  GroupArrangement,
  GroupItemsState,
} from "@/features/groceries/components/dnd/types";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMultiContainerCollisionDetection } from "@/features/groceries/components/dnd/collision-detection";
import { planDrop } from "@/features/groceries/components/dnd/drop-plan";
import {
  buildGroupItemsState,
  findContainerForGroup,
} from "@/features/groceries/components/dnd/utils";
import { arrayMove } from "@dnd-kit/sortable";

import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

interface UseGroupedGroceryDndResult {
  // State
  activeGroupKey: string | null;
  activeGroup: GroceryGroup | null;
  overContainerId: ContainerId | null;
  arrangement: GroupArrangement | null;

  // Collision detection
  collisionDetection: CollisionDetection;

  // Handlers
  handleDragStart: (event: DragStartEvent) => void;
  handleDragOver: (event: DragOverEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
}

export function useGroupedGroceryDnd({
  stores,
  groupedGroceries,
  onReorderGroups,
  aisleFor,
  onFileGroceryName,
}: Omit<DndGroupedGroceryProviderProps, "children">): UseGroupedGroceryDndResult {
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<ContainerId | null>(null);

  // Group items state: container ID -> array of group keys
  // This updates during drag to reflect visual state
  const [groupItems, setGroupItems] = useState<GroupItemsState>(() =>
    buildGroupItemsState(groupedGroceries, stores)
  );

  // From a drag's start until the list it was dropped on comes back, the
  // Stores show groupItems; otherwise each reads its own groups.
  const [arranged, setArranged] = useState(false);

  // Clone of groupItems at drag start - used for cancel recovery
  const clonedGroupItemsRef = useRef<GroupItemsState | null>(null);

  // Refs for stable collision detection (from reference implementation)
  const lastOverIdRef = useRef<string | null>(null);
  const recentlyMovedToNewContainerRef = useRef(false);

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

  // Sync groupItems when groupedGroceries/stores change externally. A filing
  // regroups the list, so a housemate's filing arrives as new groups here.
  const source = { groupedGroceries, stores };
  const [prevSource, setPrevSource] = useState(source);

  // Only rebuild if we're not actively dragging and the source changed
  if (
    !activeGroupKey &&
    (groupedGroceries !== prevSource.groupedGroceries || stores !== prevSource.stores)
  ) {
    setPrevSource(source);
    if (arranged) setArranged(false);
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
      recentlyMovedToNewContainerRef.current = false;
    });
  }, [groupItems]);

  // Built per call rather than once per render: the refs it reads are read
  // mid-drag, never while rendering.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) =>
      createMultiContainerCollisionDetection(
        groupItems,
        activeGroupKey,
        lastOverIdRef,
        recentlyMovedToNewContainerRef
      )(args),
    [groupItems, activeGroupKey]
  );

  const activeGroup = useMemo(() => {
    if (!activeGroupKey) return null;

    return groupMap.get(activeGroupKey) ?? null;
  }, [activeGroupKey, groupMap]);

  const arrangement = useMemo<GroupArrangement | null>(
    () => (arranged ? { items: groupItems, groups: groupMap } : null),
    [arranged, groupItems, groupMap]
  );

  const findContainer = useCallback(
    (id: string): ContainerId | undefined => {
      // Check if id is a container itself
      if (id in groupItems) {
        return id;
      }

      // Find which container has this group
      return Object.keys(groupItems).find((key) => groupItems[key]?.includes(id));
    },
    [groupItems]
  );

  const handleDragStart = useCallback(
    ({ active }: DragStartEvent) => {
      const groupKey = active.id as string;

      setActiveGroupKey(groupKey);
      setArranged(true);
      // Clone current groupItems for cancel recovery
      clonedGroupItemsRef.current = JSON.parse(JSON.stringify(groupItems));

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

          if (!activeItems || !overItems) {
            return prevItems;
          }

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

          recentlyMovedToNewContainerRef.current = true;

          return {
            ...prevItems,
            [activeContainer]: activeItems.filter((key) => key !== active.id),
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
      const originalGroupItems = clonedGroupItemsRef.current;
      const currentContainer = findContainer(active.id as string);

      if (!currentContainer) {
        setActiveGroupKey(null);
        setArranged(false);
        setOverContainerId(null);
        clonedGroupItemsRef.current = null;

        return;
      }

      const overId = over?.id;

      if (overId == null) {
        // No valid drop - restore original
        if (originalGroupItems) {
          setGroupItems(originalGroupItems);
        }
        setActiveGroupKey(null);
        setArranged(false);
        setOverContainerId(null);
        clonedGroupItemsRef.current = null;

        return;
      }

      // Commit what the drag arranged: the reorder first, then what the drop
      // teaches the Store — every distinct name in the group, since a group
      // behaves as the one thing it looks like.
      const originalContainer = originalGroupItems
        ? findContainerForGroup(active.id as string, originalGroupItems)
        : null;
      const movedGroup = groupMap.get(active.id as string);
      const { updates, filings } =
        originalContainer && movedGroup
          ? planDrop({
              items: groupItems,
              originContainer: originalContainer,
              targetContainer: currentContainer,
              stores,
              aisleFor,
              movedIds: movedGroup.sources.map((source) => source.grocery.id),
              movedGroceries: movedGroup.sources.map((source) => source.grocery),
              idsOf: (groupKey) =>
                groupMap.get(groupKey)?.sources.map((source) => source.grocery.id) ?? [],
            })
          : { updates: [], filings: [] };

      if (updates.length > 0) onReorderGroups(updates);
      for (const filing of filings)
        onFileGroceryName(filing.storeId, filing.grocery, filing.aisleId);
      // A drop that writes nothing brings no list back, so the Stores read their own groups now.
      if (updates.length === 0 && filings.length === 0) setArranged(false);

      setActiveGroupKey(null);
      setOverContainerId(null);
      clonedGroupItemsRef.current = null;
    },
    [findContainer, groupItems, groupMap, stores, aisleFor, onReorderGroups, onFileGroceryName]
  );

  const handleDragCancel = useCallback(() => {
    if (clonedGroupItemsRef.current) {
      setGroupItems(clonedGroupItemsRef.current);
    }
    setActiveGroupKey(null);
    setArranged(false);
    setOverContainerId(null);
    clonedGroupItemsRef.current = null;
  }, []);

  return {
    activeGroupKey,
    activeGroup,
    overContainerId,
    arrangement,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}
