"use client";

import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";

import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";

import { StoreSection } from "./store-section";
import { StoreDropZone } from "./store-drop-zone";

interface GroceryListProps {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  onAssignToStore?: (groceryId: string, storeId: string | null) => void;
}

export function GroceryList({
  groceries,
  stores,
  recurringGroceries,
  onToggle,
  onEdit,
  onDelete,
  onAssignToStore,
}: GroceryListProps) {
  // Track which grocery is being dragged
  const [draggingGroceryId, setDraggingGroceryId] = useState<string | null>(null);

  const handleDragStart = useCallback((groceryId: string) => {
    setDraggingGroceryId(groceryId);
  }, []);

  const handleDragEnd = useCallback(() => {
    // Delay clearing to allow drop zones to process the pointerup event
    setTimeout(() => {
      setDraggingGroceryId(null);
    }, 100);
  }, []);

  const handleDrop = useCallback((targetStoreId: string | null) => {
    if (draggingGroceryId && onAssignToStore) {
      const grocery = groceries.find((g) => g.id === draggingGroceryId);
      if (grocery && grocery.storeId !== targetStoreId) {
        onAssignToStore(draggingGroceryId, targetStoreId);
      }
    }
  }, [draggingGroceryId, groceries, onAssignToStore]);

  // Get the current store of the dragged item
  const draggedItemStoreId = useMemo(() => {
    if (!draggingGroceryId) return undefined;
    const grocery = groceries.find((g) => g.id === draggingGroceryId);
    return grocery?.storeId ?? null;
  }, [draggingGroceryId, groceries]);

  // Group groceries by storeId
  const groupedGroceries = useMemo(() => {
    const groups: Map<string | null, GroceryDto[]> = new Map();

    // Initialize with null for unsorted
    groups.set(null, []);

    // Initialize groups for each store
    stores.forEach((store) => {
      groups.set(store.id, []);
    });

    // Group groceries
    groceries.forEach((grocery) => {
      const storeId = grocery.storeId;
      // If the storeId doesn't exist in our map (orphaned), put in unsorted
      if (!groups.has(storeId)) {
        groups.get(null)!.push(grocery);
      } else {
        groups.get(storeId)!.push(grocery);
      }
    });

    return groups;
  }, [groceries, stores]);

  // Get unsorted groceries
  const unsortedGroceries = groupedGroceries.get(null) ?? [];

  // Get store in order with their groceries
  const storeWithGroceries = useMemo(() => {
    return stores
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((store) => ({
        store,
        groceries: groupedGroceries.get(store.id) ?? [],
      }));
  }, [stores, groupedGroceries]);

  // Check if there are any groceries at all
  const hasGroceries = groceries.length > 0;
  const hasStores = stores.length > 0;

  if (!hasGroceries && !hasStores) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
        <div className="text-default-300 text-6xl">🛒</div>
        <div className="text-center">
          <p className="text-default-600 text-lg font-medium">Your list is empty</p>
          <p className="text-default-400 text-sm">Add items using the button below</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      <AnimatePresence mode="popLayout">
        {/* Unsorted section always first if it has items */}
        {unsortedGroceries.length > 0 && (
          <motion.div
            key="unsorted"
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.95 }}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <StoreDropZone
              draggedItemStoreId={draggedItemStoreId}
              isDraggingItem={draggingGroceryId !== null}
              storeId={null}
              onDrop={handleDrop}
            >
              <StoreSection
                groceries={unsortedGroceries}
                isDraggingAny={draggingGroceryId !== null}
                recurringGroceries={recurringGroceries}
                store={null}
                onDelete={onDelete}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onEdit={onEdit}
                onToggle={onToggle}
              />
            </StoreDropZone>
          </motion.div>
        )}

        {/* Store sections */}
        {storeWithGroceries.map(({ store, groceries: storeGroceries }) => (
          <motion.div
            key={store.id}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            initial={{ opacity: 0, scale: 0.95 }}
            layout
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <StoreDropZone
              draggedItemStoreId={draggedItemStoreId}
              isDraggingItem={draggingGroceryId !== null}
              storeId={store.id}
              onDrop={handleDrop}
            >
              <StoreSection
                groceries={storeGroceries}
                isDraggingAny={draggingGroceryId !== null}
                recurringGroceries={recurringGroceries}
                store={store}
                onDelete={onDelete}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onEdit={onEdit}
                onToggle={onToggle}
              />
            </StoreDropZone>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
