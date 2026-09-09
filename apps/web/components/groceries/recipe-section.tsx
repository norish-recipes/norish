"use client";

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "motion/react";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";

import { GroceryDragOverlay, SortableGroceryItem } from "./dnd";
import { DoneRow } from "./done-row";
import { GroceryItem } from "./grocery-item";
import { StoreHeading } from "./store-heading";

function sortGroceries(groceries: GroceryDto[], transitioningIds: Set<string>): GroceryDto[] {
  return [...groceries].sort((a, b) => {
    const aEffectiveDone = a.isDone && !transitioningIds.has(a.id);
    const bEffectiveDone = b.isDone && !transitioningIds.has(b.id);

    // Separate active and done items
    if (aEffectiveDone !== bEffectiveDone) {
      return aEffectiveDone ? 1 : -1;
    }

    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

// Delay before reordering after toggle (ms)
const REORDER_DELAY = 600;

interface RecipeSectionProps {
  /** The recipe, or null for the groceries that came from none; the section keys on it. */
  recipeId: string | null;
  recipeName: string;
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  stores: StoreDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  onReorder?: (updates: { id: string; sortOrder: number }[]) => void;
  defaultExpanded?: boolean;
}

function RecipeSectionComponent({
  recipeName,
  groceries,
  recurringGroceries,
  stores,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
  defaultExpanded = true,
}: RecipeSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Track items that are transitioning (just toggled) - delay their reorder
  const [transitioningIds, setTransitioningIds] = useState<Set<string>>(new Set());
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutRefs.current;

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  // Wrap onToggle to track transitioning items
  const handleToggle = useCallback(
    (id: string, isDone: boolean) => {
      // Call the actual toggle
      onToggle(id, isDone);

      // If checking off, add to transitioning set
      if (isDone) {
        setTransitioningIds((prev) => new Set(prev).add(id));

        // Clear any existing timeout for this id
        const existingTimeout = timeoutRefs.current.get(id);

        if (existingTimeout) clearTimeout(existingTimeout);

        // Remove from transitioning after delay
        const timeout = setTimeout(() => {
          setTransitioningIds((prev) => {
            const next = new Set(prev);

            next.delete(id);

            return next;
          });
          timeoutRefs.current.delete(id);
        }, REORDER_DELAY);

        timeoutRefs.current.set(id, timeout);
      }
    },
    [onToggle]
  );

  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;

  // Sort groceries using helper function
  const sortedGroceries = sortGroceries(groceries, transitioningIds);

  // Separate active and done items from props
  const propsActiveGroceries = sortedGroceries.filter(
    (g) => !g.isDone && !transitioningIds.has(g.id)
  );
  const doneGroceries = sortedGroceries.filter((g) => g.isDone || transitioningIds.has(g.id));

  // =============================================================================
  // Local ordered IDs state (persists visual order during and after drag)
  // =============================================================================
  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    propsActiveGroceries.map((g) => g.id)
  );

  // Track previous props active IDs to detect external changes
  const prevPropsActiveIdsRef = useRef<string[]>(propsActiveGroceries.map((g) => g.id));

  // Sync orderedIds when groceries change from external source (not during drag)
  // Only update if the set of IDs changed (new items added, items removed, etc.)
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (activeId) return; // Don't sync during drag

    const currentPropsIds = propsActiveGroceries.map((g) => g.id);
    const prevPropsIds = prevPropsActiveIdsRef.current;

    // Check if the set of IDs changed
    const currentSet = new Set(currentPropsIds);
    const prevSet = new Set(prevPropsIds);
    const setsEqual =
      currentSet.size === prevSet.size && [...currentSet].every((id) => prevSet.has(id));

    if (!setsEqual) {
      // IDs changed (items added/removed) - rebuild from props
      setOrderedIds(currentPropsIds);
    }

    prevPropsActiveIdsRef.current = currentPropsIds;
  }, [propsActiveGroceries, activeId]);

  // Build ordered active groceries from orderedIds
  const orderedActiveGroceries = useMemo(() => {
    const groceryMap = new Map(propsActiveGroceries.map((g) => [g.id, g]));

    return orderedIds.map((id) => groceryMap.get(id)).filter(Boolean) as GroceryDto[];
  }, [orderedIds, propsActiveGroceries]);

  // =============================================================================
  // DnD Setup
  // =============================================================================

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get the active grocery for overlay
  const activeGrocery = useMemo(() => {
    if (!activeId) return null;

    return groceries.find((g) => g.id === activeId) ?? null;
  }, [activeId, groceries]);

  const activeRecurringGrocery = useMemo(() => {
    if (!activeGrocery?.recurringGroceryId) return null;

    return recurringGroceries.find((r) => r.id === activeGrocery.recurringGroceryId) ?? null;
  }, [activeGrocery, recurringGroceries]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);

      const { active, over } = event;

      if (!over || active.id === over.id) return;

      // Find indices in current orderedIds
      const oldIndex = orderedIds.indexOf(active.id as string);
      const newIndex = orderedIds.indexOf(over.id as string);

      if (oldIndex === -1 || newIndex === -1) return;

      // Update local state immediately (optimistic)
      const newOrder = arrayMove(orderedIds, oldIndex, newIndex);

      setOrderedIds(newOrder);

      // Call backend with new sort orders
      if (onReorder) {
        const updates = newOrder.map((id, index) => ({ id, sortOrder: index }));

        onReorder(updates);
      }
    },
    [orderedIds, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Get store for a grocery
  const getStoreForGrocery = (grocery: GroceryDto): StoreDto | null => {
    if (!grocery.storeId) return null;

    return stores.find((s) => s.id === grocery.storeId) ?? null;
  };

  // A recipe's rows under its heading bar, in one card; collapsed, the bar alone.
  const hasRows = isExpanded && groceries.length > 0;

  return (
    <motion.div
      className="border-border bg-surface shadow-surface relative overflow-hidden rounded-xl border"
      data-testid="store-card"
    >
      <div className="bg-surface-secondary">
        <StoreHeading
          activeCount={activeCount}
          doneCount={doneCount}
          expanded={isExpanded}
          name={recipeName}
          onExpandedChange={setIsExpanded}
        />
      </div>

      {hasRows && (
        <div className="border-border border-t" data-testid="store-rows">
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
          >
            <div className="divide-border divide-y">
              {/* Active (not done) items - sortable; each checkbox in the colour of the Store it is assigned to */}
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {orderedActiveGroceries.map((grocery, index) => {
                  const recurringGrocery = grocery.recurringGroceryId
                    ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
                    : null;
                  const store = getStoreForGrocery(grocery);
                  const isFirst = index === 0;
                  const isLast =
                    index === orderedActiveGroceries.length - 1 && doneGroceries.length === 0;

                  return (
                    <SortableGroceryItem key={grocery.id} grocery={grocery}>
                      <GroceryItem
                        grocery={grocery}
                        isFirst={isFirst}
                        isLast={isLast}
                        recurringGrocery={recurringGrocery}
                        store={store}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onToggle={handleToggle}
                      />
                    </SortableGroceryItem>
                  );
                })}
              </SortableContext>

              {/* The done tail, folded into one row that opens on tap; not sortable */}
              {doneGroceries.length > 0 && (
                <DoneRow count={doneGroceries.length}>
                  {doneGroceries.map((grocery, index) => {
                    const recurringGrocery = grocery.recurringGroceryId
                      ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ??
                        null)
                      : null;
                    const store = getStoreForGrocery(grocery);

                    return (
                      <GroceryItem
                        key={grocery.id}
                        grocery={grocery}
                        isLast={index === doneGroceries.length - 1}
                        recurringGrocery={recurringGrocery}
                        store={store}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onToggle={handleToggle}
                      />
                    );
                  })}
                </DoneRow>
              )}
            </div>

            <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
              {activeGrocery ? (
                <GroceryDragOverlay
                  grocery={activeGrocery}
                  recurringGrocery={activeRecurringGrocery}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </motion.div>
  );
}

export const RecipeSection = memo(RecipeSectionComponent);
