"use client";

import { createContext, use, useId } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import { keyedLines } from "@norish/shared-react/groceries";

import type { DndGroceryContextValue, DndGroceryProviderProps } from "./types";
import { GroceryDragOverlay } from "./grocery-drag-overlay";
import { useListDnd } from "./use-list-dnd";

const DndGroceryContext = createContext<DndGroceryContextValue | null>(null);

export function useDndGroceryContext(): DndGroceryContextValue {
  const ctx = use(DndGroceryContext);

  if (!ctx) throw new Error("useDndGroceryContext must be used within DndGroceryProvider");

  return ctx;
}

export function DndGroceryProvider({
  children,
  groceriesByStore,
  stores,
  recurringGroceries,
  onReorderInStore,
  aisleFor,
  onFileGroceryName,
  getRecipeNameForGrocery,
}: DndGroceryProviderProps) {
  const dndId = useId();
  const list = keyedLines(groceriesByStore, stores, aisleFor);
  const rows = list.byKey;
  const dnd = useListDnd({
    items: list.items,
    source: [groceriesByStore, stores, aisleFor],
    linesOf: list.linesOf,
    stores,
    aisleFor,
    onReorder: onReorderInStore,
    onFileGroceryName,
  });
  const activeGrocery = dnd.activeId ? (rows.get(dnd.activeId) ?? null) : null;
  // Null while no drag is on, so a list change leaves the context as it was.
  const arrangement = dnd.arranged ? { items: dnd.arranged, byKey: rows } : null;
  const contextValue = {
    activeId: dnd.activeId,
    overContainerId: dnd.overContainerId,
    arrangement,
  };

  return (
    <DndGroceryContext value={contextValue}>
      <DndContext
        collisionDetection={dnd.collisionDetection}
        id={dndId}
        sensors={dnd.sensors}
        onDragCancel={dnd.handleDragCancel}
        onDragEnd={dnd.handleDragEnd}
        onDragOver={dnd.handleDragOver}
        onDragStart={dnd.handleDragStart}
      >
        {children}

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeGrocery ? (
            <ActiveGroceryOverlay
              getRecipeNameForGrocery={getRecipeNameForGrocery}
              grocery={activeGrocery}
              recurringGroceries={recurringGroceries}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </DndGroceryContext>
  );
}

/** The row a drag carries. Its own component, so the provider's values stay memoised apart from it. */
function ActiveGroceryOverlay({
  grocery,
  recurringGroceries,
  getRecipeNameForGrocery,
}: {
  grocery: GroceryDto;
  recurringGroceries: RecurringGroceryDto[];
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
}) {
  const recurringGrocery = grocery.recurringGroceryId
    ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
    : null;

  return (
    <GroceryDragOverlay
      grocery={grocery}
      recipeName={getRecipeNameForGrocery?.(grocery) ?? null}
      recurringGrocery={recurringGrocery}
    />
  );
}
