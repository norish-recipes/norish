"use client";

import type { DndGroceryContextValue, DndGroceryProviderProps } from "./types";

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

import { GroceryDragOverlay } from "./grocery-drag-overlay";
import { useGroceryDnd } from "./use-grocery-dnd";

const DndGroceryContext = createContext<DndGroceryContextValue | null>(null);

export function useDndGroceryContext(): DndGroceryContextValue {
  const ctx = useContext(DndGroceryContext);

  if (!ctx) throw new Error("useDndGroceryContext must be used within DndGroceryProvider");

  return ctx;
}

export function DndGroceryProvider({
  children,
  groceries,
  stores,
  recurringGroceries,
  onReorderInStore,
  getRecipeNameForGrocery,
}: DndGroceryProviderProps) {
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
  } = useGroceryDnd({
    groceries,
    stores,
    recurringGroceries,
    onReorderInStore,
    getRecipeNameForGrocery,
  });

  const contextValue = useMemo<DndGroceryContextValue>(
    () => ({
      activeId,
      activeGrocery,
      overContainerId,
      items,
      getItemsForContainer,
    }),
    [activeId, activeGrocery, overContainerId, items, getItemsForContainer]
  );

  return (
    <DndGroceryContext.Provider value={contextValue}>
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
          {activeGrocery ? (
            <GroceryDragOverlay
              grocery={activeGrocery}
              recipeName={activeRecipeName}
              recurringGrocery={activeRecurringGrocery}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndGroceryContext.Provider>
  );
}
