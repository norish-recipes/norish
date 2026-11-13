"use client";

import { createContext, use, useId } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";

import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import type { DndGroupedGroceryContextValue, DndGroupedGroceryProviderProps } from "./types";
import { GroupDragOverlay } from "./group-drag-overlay";
import { useListDnd } from "./use-list-dnd";
import { buildGroupItemsState } from "./utils";

const DndGroupedGroceryContext = createContext<DndGroupedGroceryContextValue | null>(null);

export function useDndGroupedGroceryContext(): DndGroupedGroceryContextValue {
  const ctx = use(DndGroupedGroceryContext);

  if (!ctx)
    throw new Error("useDndGroupedGroceryContext must be used within DndGroupedGroceryProvider");

  return ctx;
}

export function DndGroupedGroceryProvider({
  children,
  stores,
  groupedGroceries,
  onReorderGroups,
  aisleFor,
  onFileGroceryName,
}: DndGroupedGroceryProviderProps) {
  const dndId = useId();
  const groups = new Map<string, GroceryGroup>();

  for (const storeGroups of groupedGroceries.values()) {
    for (const group of storeGroups) groups.set(group.groupKey, group);
  }

  const dnd = useListDnd({
    items: buildGroupItemsState(groupedGroceries, stores),
    source: [groupedGroceries, stores],
    linesOf: (key) => groups.get(key)?.sources.map((source) => source.grocery) ?? [],
    stores,
    aisleFor,
    onReorder: onReorderGroups,
    onFileGroceryName,
  });
  const activeGroup = dnd.activeId ? (groups.get(dnd.activeId) ?? null) : null;
  // Null while no drag is on, so a list change leaves the context as it was.
  const arrangement = dnd.arranged ? { items: dnd.arranged, byKey: groups } : null;
  const contextValue = {
    activeId: dnd.activeId,
    overContainerId: dnd.overContainerId,
    arrangement,
  };

  return (
    <DndGroupedGroceryContext value={contextValue}>
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
          {activeGroup ? <GroupDragOverlay group={activeGroup} /> : null}
        </DragOverlay>
      </DndContext>
    </DndGroupedGroceryContext>
  );
}
