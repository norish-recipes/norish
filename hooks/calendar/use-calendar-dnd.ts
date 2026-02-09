import {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
  rectIntersection,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState, useCallback, useMemo, useRef } from "react";
import { arrayMove } from "@dnd-kit/sortable";

import { CalendarItemViewDto, Slot } from "@/types";
import { useCalendarContext } from "@/app/(app)/calendar/context";

export type CalendarContainerId = string;
export type CalendarItemsState = Record<CalendarContainerId, string[]>;

export function parseContainerId(id: string): { date: string; slot: Slot } | null {
  const parts = id.split("_");

  if (parts.length < 2) return null;
  const slot = parts.pop() as Slot;
  const date = parts.join("_");

  return { date, slot };
}

function buildItemsState(
  plannedItemsByDate: Record<string, CalendarItemViewDto[]>
): CalendarItemsState {
  const items: CalendarItemsState = {};
  const slots: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

  for (const [date, dateItems] of Object.entries(plannedItemsByDate)) {
    for (const slot of slots) {
      const containerId = `${date}_${slot}`;

      items[containerId] = dateItems
        .filter((item) => item.slot === slot)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => item.id);
    }
  }

  return items;
}

function findContainerForItem(
  itemId: string,
  items: CalendarItemsState
): CalendarContainerId | undefined {
  return Object.keys(items).find((key) => items[key].includes(itemId));
}

export function useCalendarDnd() {
  const { plannedItemsByDate, moveItem } = useCalendarContext();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overContainerId, setOverContainerId] = useState<CalendarContainerId | null>(null);

  // Persistent local state - syncs with external data only when not dragging
  const [items, setItems] = useState<CalendarItemsState>(() => buildItemsState(plannedItemsByDate));

  const clonedItems = useRef<CalendarItemsState | null>(null);

  // Track previous plannedItemsByDate to detect external changes
  const prevPlannedItemsRef = useRef<Record<string, CalendarItemViewDto[]>>(plannedItemsByDate);

  // Sync with external data only when not actively dragging
  if (!activeId && plannedItemsByDate !== prevPlannedItemsRef.current) {
    prevPlannedItemsRef.current = plannedItemsByDate;
    const newItems = buildItemsState(plannedItemsByDate);
    const itemsChanged =
      JSON.stringify(Object.keys(newItems).sort()) !== JSON.stringify(Object.keys(items).sort()) ||
      Object.keys(newItems).some(
        (key) => JSON.stringify(newItems[key]) !== JSON.stringify(items[key])
      );

    if (itemsChanged) {
      setItems(newItems);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const collisionDetection = useMemo<CollisionDetection>(
    () => (args) => {
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        const itemCollision = pointerCollisions.find(
          (collision) => !parseContainerId(collision.id as string)
        );

        if (itemCollision) return [itemCollision];

        return pointerCollisions;
      }

      return rectIntersection(args);
    },
    []
  );

  const findContainer = useCallback(
    (id: string): CalendarContainerId | undefined => {
      if (id in items) return id;
      if (parseContainerId(id)) return id;

      return Object.keys(items).find((key) => items[key].includes(id));
    },
    [items]
  );

  const getItemsForContainer = useCallback(
    (containerId: CalendarContainerId): string[] => {
      return items[containerId] ?? [];
    },
    [items]
  );

  const itemsById = useMemo(() => {
    const map = new Map<string, CalendarItemViewDto>();

    for (const dateItems of Object.values(plannedItemsByDate)) {
      for (const item of dateItems) {
        map.set(item.id, item);
      }
    }

    return map;
  }, [plannedItemsByDate]);

  const getItemById = useCallback(
    (itemId: string): CalendarItemViewDto | undefined => {
      return itemsById.get(itemId);
    },
    [itemsById]
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;

    return itemsById.get(activeId) ?? null;
  }, [activeId, itemsById]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const id = active.id as string;

      setActiveId(id);
      clonedItems.current = JSON.parse(JSON.stringify(items));

      const containerId = findContainerForItem(id, items);

      setOverContainerId(containerId ?? null);
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
          if (!prevItems) return prevItems;

          const activeItems = prevItems[activeContainer] ?? [];
          const overItems = prevItems[overContainer] ?? [];
          const overIndex = overItems.indexOf(overId as string);

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

          return {
            ...prevItems,
            [activeContainer]: activeItems.filter((item) => item !== active.id),
            [overContainer]: [
              ...overItems.slice(0, newIndex),
              active.id as string,
              ...overItems.slice(newIndex),
            ],
          };
        });
      } else {
        setItems((prevItems) => {
          if (!prevItems) return prevItems;

          const containerItems = prevItems[activeContainer] ?? [];
          const activeIndex = containerItems.indexOf(active.id as string);
          const overIndex = containerItems.indexOf(overId as string);

          if (activeIndex !== overIndex && overIndex >= 0) {
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
    (event: DragEndEvent) => {
      const { active, over } = event;
      const originalItems = clonedItems.current;

      setActiveId(null);
      setOverContainerId(null);
      clonedItems.current = null;

      if (!over || !originalItems) {
        if (originalItems) setItems(originalItems);

        return;
      }

      const activeIdStr = active.id as string;
      const currentContainer = findContainer(activeIdStr);

      if (!currentContainer) {
        setItems(originalItems);

        return;
      }

      const originalContainer = findContainerForItem(activeIdStr, originalItems);

      if (!originalContainer) {
        setItems(originalItems);

        return;
      }

      const originalParsed = parseContainerId(originalContainer);
      const currentParsed = parseContainerId(currentContainer);

      if (!originalParsed || !currentParsed) {
        setItems(originalItems);

        return;
      }

      const currentItems = items[currentContainer] ?? [];
      const targetIndex = currentItems.indexOf(activeIdStr);

      const positionChanged =
        originalContainer !== currentContainer ||
        originalItems[originalContainer].indexOf(activeIdStr) !== targetIndex;

      if (!positionChanged) {
        return;
      }

      moveItem(
        activeIdStr,
        currentParsed.date,
        currentParsed.slot,
        targetIndex >= 0 ? targetIndex : 0
      );
    },
    [findContainer, items, moveItem]
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
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    activeId,
    activeItem,
    overContainerId,
    items,
    getItemsForContainer,
    getItemById,
  };
}
