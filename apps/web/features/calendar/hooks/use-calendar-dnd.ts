import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { dateKeyOfDrop } from "@/components/calendar/day-drop-id";
import { pointerWithin, rectIntersection } from "@dnd-kit/core";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { dayDropTarget, useCalendarMutations } from "@norish/shared-react/calendar";

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

/** A planned item dragged onto another day, keeping its slot and landing last in it. */
export function useCalendarDnd(calendarData: Record<string, PlannedItemFromQuery[]>) {
  const { moveItem } = useCalendarMutations();
  const [activeItem, setActiveItem] = useState<PlannedItemFromQuery | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const onDragStart = ({ active }: DragStartEvent) => {
    const item = Object.values(calendarData)
      .flat()
      .find((i) => i.id === active.id);

    if (item) setActiveItem(item);
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    const target = activeItem ? dateKeyOfDrop(over?.id) : null;

    setDragOverDateKey(target !== activeItem?.date ? target : null);
  };

  const resetDrag = () => {
    setActiveItem(null);
    setDragOverDateKey(null);
  };

  const onDragEnd = ({ over }: DragEndEvent) => {
    const draggedItem = activeItem;
    const targetDate = dateKeyOfDrop(over?.id);

    resetDrag();

    if (!draggedItem) return;

    const target = dayDropTarget(
      targetDate ? (calendarData[targetDate] ?? []) : [],
      draggedItem,
      targetDate
    );

    if (target) moveItem(draggedItem.id, target.date, target.slot, target.index);
  };

  return {
    activeItem,
    dragOverDateKey,
    dndContextProps: {
      collisionDetection,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: resetDrag,
    },
  };
}
