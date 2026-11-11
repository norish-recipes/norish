import type { PlannedItemDisplay } from "@/components/calendar/types";
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";
import { useState } from "react";
import { pointerWithin, rectIntersection } from "@dnd-kit/core";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { useCalendarMutations } from "@norish/shared-react/calendar";

// A day accepts drops under the id "<dateKey>_drop".
const dropDateKey = (overId: string | number | undefined) =>
  typeof overId === "string" && overId.endsWith("_drop") ? overId.replace("_drop", "") : null;

const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);

  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
};

/** A planned item dragged onto another day, keeping its slot and landing last in it. */
export function useCalendarDnd(
  calendarData: Record<string, PlannedItemFromQuery[]>,
  sensors: SensorDescriptor<SensorOptions>[]
) {
  const { moveItem } = useCalendarMutations();
  const [activeItem, setActiveItem] = useState<PlannedItemDisplay | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const onDragStart = ({ active }: DragStartEvent) => {
    const item = Object.values(calendarData)
      .flat()
      .find((i) => i.id === active.id);

    if (item) setActiveItem(item);
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    const target = activeItem ? dropDateKey(over?.id) : null;

    setDragOverDateKey(target !== activeItem?.date ? target : null);
  };

  const onDragCancel = () => {
    setActiveItem(null);
    setDragOverDateKey(null);
  };

  const onDragEnd = ({ over }: DragEndEvent) => {
    const draggedItem = activeItem;
    const targetDate = dropDateKey(over?.id);

    onDragCancel();

    if (!draggedItem || !targetDate || targetDate === draggedItem.date) return;

    const targetIndex = (calendarData[targetDate] ?? []).filter(
      (i) => i.slot === draggedItem.slot && i.id !== draggedItem.id
    ).length;

    moveItem(draggedItem.id, targetDate, draggedItem.slot, targetIndex);
  };

  return {
    activeItem,
    dragOverDateKey,
    dndContextProps: {
      sensors,
      collisionDetection,
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel,
    },
  };
}
