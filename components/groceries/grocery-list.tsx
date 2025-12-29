"use client";

import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";

import { useMemo, useState, useCallback } from "react";
import { motion } from "motion/react";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";

import { StoreSection } from "./store-section";

interface GroceryListProps {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  onAssignToStore?: (groceryId: string, storeId: string | null) => void;
  onReorderInStore?: (updates: { id: string; sortOrder: number }[], backendOnly?: boolean) => void;
  onMarkAllDoneInStore?: (storeId: string | null) => void;
  onDeleteDoneInStore?: (storeId: string | null) => void;
}

export function GroceryList({
  groceries,
  stores,
  recurringGroceries,
  onToggle,
  onEdit,
  onDelete,
  onAssignToStore,
  onReorderInStore,
  onMarkAllDoneInStore,
  onDeleteDoneInStore,
}: GroceryListProps) {
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

  // Track dragging state for cross-store assignment
  const [draggingGroceryId, setDraggingGroceryId] = useState<string | null>(null);
  const [draggingStoreId, setDraggingStoreId] = useState<string | null | 'unsorted'>(null);

  const handleDragStart = useCallback((groceryId: string) => {
    setDraggingGroceryId(groceryId);
  }, []);

  const handleDragEnd = useCallback((pointerPosition: { x: number; y: number }) => {
    if (!draggingGroceryId) {
      setDraggingGroceryId(null);
      return;
    }

    const grocery = groceries.find((g) => g.id === draggingGroceryId);
    if (!grocery) {
      setDraggingGroceryId(null);
      return;
    }

    // Check if dropped on a store section using pointer position
    const { x, y } = pointerPosition;
    const elementsAtPoint = document.elementsFromPoint(x, y);
    
    let foundStoreSection = false;
    let targetStoreId: string | null = null;
    
    for (const element of elementsAtPoint) {
      const storeIdAttr = element.getAttribute('data-store-id');
      if (storeIdAttr !== null) {
        foundStoreSection = true;
        targetStoreId = storeIdAttr === 'unsorted' ? null : storeIdAttr;
        break;
      }
    }

    const currentStoreId = grocery.storeId ?? null;
    
    // Cross-store move - dropped on a different store
    if (foundStoreSection && currentStoreId !== targetStoreId && onAssignToStore) {
      onAssignToStore(draggingGroceryId, targetStoreId);
    }
    // Within-store reorder - dropped on same store
    else if (foundStoreSection && currentStoreId === targetStoreId && onReorderInStore) {
      // Send final positions to backend
      const storeGroceries = groceries.filter(g => g.storeId === currentStoreId && !g.isDone);
      const updates = storeGroceries.map((g, index) => ({
        id: g.id,
        sortOrder: index,
      }));
      if (updates.length > 0) {
        onReorderInStore(updates, true); // true = updateBackend (send to backend)
      }
    }

    setDraggingGroceryId(null);
  }, [draggingGroceryId, groceries, onAssignToStore, onReorderInStore]);

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
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="bg-content1/90 shadow-large relative w-full max-w-xl rounded-xl backdrop-blur-xl">
          <div className="flex flex-col items-center gap-6 p-10 text-center">
            <div className="relative">
              <div className="bg-primary-500/20 dark:bg-primary-400/15 absolute inset-0 scale-125 rounded-full blur-3xl" />
              <div className="bg-primary-500/15 text-primary-500 relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                <ShoppingCartIcon className="h-7 w-7" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your grocery list awaits</h2>
              <p className="text-default-500 text-base">
                Add items using the "Add Item" button above to get started.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-1">
      {/* Unsorted section always first if it has items */}
      {unsortedGroceries.length > 0 && (
        <motion.div
          key="unsorted"
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          layout
          style={{ zIndex: draggingStoreId === 'unsorted' ? 50 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          <StoreSection
            groceries={unsortedGroceries}
            recurringGroceries={recurringGroceries}
            store={null}
            isDraggingAny={draggingGroceryId !== null}
            onDelete={onDelete}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDraggingInSection={(isDragging) => setDraggingStoreId(isDragging ? 'unsorted' : null)}
            onEdit={onEdit}
            onReorderInStore={onReorderInStore}
            onToggle={onToggle}
            onMarkAllDone={() => onMarkAllDoneInStore?.(null)}
            onDeleteDone={() => onDeleteDoneInStore?.(null)}
          />
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
          style={{ zIndex: draggingStoreId === store.id ? 50 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          <StoreSection
            groceries={storeGroceries}
            recurringGroceries={recurringGroceries}
            store={store}
            isDraggingAny={draggingGroceryId !== null}
            onDelete={onDelete}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            onDraggingInSection={(isDragging) => setDraggingStoreId(isDragging ? store.id : null)}
            onEdit={onEdit}
            onReorderInStore={onReorderInStore}
            onToggle={onToggle}
            onMarkAllDone={() => onMarkAllDoneInStore?.(store.id)}
            onDeleteDone={() => onDeleteDoneInStore?.(store.id)}
          />
        </motion.div>
      ))}
    </div>
  );
}
