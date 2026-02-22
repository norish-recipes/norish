"use client";

import type { DndGroupedGroceryContextValue, DndGroupedGroceryProviderProps } from "./types";

import { createContext, useContext, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { GroupDragOverlay } from "./group-drag-overlay";

import { useGroupedGroceryDnd } from "@/hooks/groceries/use-grouped-grocery-dnd";

const DndGroupedGroceryContext = createContext<DndGroupedGroceryContextValue | null>(null);

export function useDndGroupedGroceryContext(): DndGroupedGroceryContextValue {
  const ctx = useContext(DndGroupedGroceryContext);

  if (!ctx)
    throw new Error("useDndGroupedGroceryContext must be used within DndGroupedGroceryProvider");

  return ctx;
}

export function DndGroupedGroceryProvider({
  children,
  stores,
  groupedGroceries,
  onReorderGroups,
}: DndGroupedGroceryProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
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
  } = useGroupedGroceryDnd({
    stores,
    groupedGroceries,
    onReorderGroups,
  });

  const contextValue = useMemo<DndGroupedGroceryContextValue>(
    () => ({
      activeGroupKey,
      activeGroup,
      overContainerId,
      groupItems,
      getGroupKeysForContainer,
    }),
    [activeGroupKey, activeGroup, overContainerId, groupItems, getGroupKeysForContainer]
  );

  return (
    <DndGroupedGroceryContext.Provider value={contextValue}>
      <DndContext
        collisionDetection={collisionDetection}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        sensors={sensors}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
      >
        {children}

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeGroup ? <GroupDragOverlay group={activeGroup} /> : null}
        </DragOverlay>
      </DndContext>
    </DndGroupedGroceryContext.Provider>
  );
}
