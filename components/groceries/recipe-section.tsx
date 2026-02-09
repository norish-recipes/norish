"use client";

import type { GroceryDto, StoreDto, RecurringGroceryDto } from "@/types";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { ChevronDownIcon, BookOpenIcon, TagIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { GroceryItem } from "./grocery-item";
import { SortableGroceryItem, GroceryDragOverlay } from "./dnd";

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
  recipeId: string | null; // null = Manual items
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
  recipeId,
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
  const t = useTranslations("groceries.store");

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

  return (
    <motion.div className="relative">
      <div className="overflow-hidden rounded-xl transition-all duration-200">
        {/* Header */}
        <div
          className={`flex w-full items-center gap-3 px-4 py-3 ${
            recipeId ? "bg-primary-100 dark:bg-primary-900/30" : "bg-default-100"
          }`}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-90"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* Icon */}
            <div
              className={`shrink-0 rounded-full p-1.5 ${
                recipeId ? "bg-primary-500" : "bg-default-400"
              }`}
            >
              {recipeId ? (
                <BookOpenIcon className="h-4 w-4 text-white" />
              ) : (
                <TagIcon className="h-4 w-4 text-white" />
              )}
            </div>

            {/* Name and count */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold">{recipeName}</span>
              <span className="text-default-400 shrink-0 text-sm">
                {activeCount > 0 && <span>{activeCount}</span>}
                {doneCount > 0 && (
                  <span className="text-default-300 ml-1">({t("done", { count: doneCount })})</span>
                )}
              </span>
            </div>

            {/* Expand/collapse chevron */}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              className="text-default-400 shrink-0"
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon className="h-5 w-5" />
            </motion.div>
          </button>
        </div>

        {/* Items with drag-and-drop for reordering */}
        {isExpanded && (
          <DndContext
            collisionDetection={closestCenter}
            sensors={sensors}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
          >
            <div className="divide-default-100 divide-y">
              {/* Active (not done) items - sortable */}
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

              {/* Done items - not sortable */}
              {doneGroceries.map((grocery, index) => {
                const recurringGrocery = grocery.recurringGroceryId
                  ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
                  : null;
                const store = getStoreForGrocery(grocery);
                const isFirst = index === 0 && orderedActiveGroceries.length === 0;
                const isLast = index === doneGroceries.length - 1;

                return (
                  <div key={grocery.id}>
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
                  </div>
                );
              })}

              {groceries.length === 0 && (
                <div className="text-default-400 px-4 py-6 text-center text-sm">{t("noItems")}</div>
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
        )}
      </div>
    </motion.div>
  );
}

export const RecipeSection = memo(RecipeSectionComponent);
