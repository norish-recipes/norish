"use client";

import type { GroceryDto, StoreDto, StoreColor, RecurringGroceryDto } from "@/types";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

import { GroceryItem } from "./grocery-item";
import { DraggableGroceryItem } from "./draggable-grocery-item";
import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { getStoreColorClasses } from "./store-colors";

interface StoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  // Drag props
  isDraggingAny: boolean;
  onDragStart?: (groceryId: string) => void;
  onDragEnd?: () => void;
}

// Delay before reordering after toggle (ms)
const REORDER_DELAY = 400;

function StoreSectionComponent({
  store,
  groceries,
  recurringGroceries,
  onToggle,
  onEdit,
  onDelete,
  defaultExpanded = true,
  isDraggingAny,
  onDragStart,
  onDragEnd,
}: StoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);
  
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

  const colorClasses = store
    ? getStoreColorClasses(store.color as StoreColor)
    : {
        bg: "bg-default-400",
        bgLight: "bg-default-100",
        text: "text-default-500",
        border: "border-default-300",
        ring: "ring-default-400",
        label: "Unsorted",
      };

  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;

  // Sort: active items first, then done items
  // BUT: items that are transitioning (just checked) stay in their original position
  const sortedGroceries = [...groceries].sort((a, b) => {
    // If either is transitioning, treat them as "not done" for sorting purposes
    const aEffectiveDone = a.isDone && !transitioningIds.has(a.id);
    const bEffectiveDone = b.isDone && !transitioningIds.has(b.id);
    
    if (aEffectiveDone === bEffectiveDone) return 0;
    return aEffectiveDone ? 1 : -1;
  });

  return (
    <div
      ref={sectionRef}
      data-store-id={store?.id ?? "unsorted"}
      className={`rounded-xl transition-all duration-200 ${isDraggingAny ? "overflow-visible" : "overflow-hidden"}`}
    >
      {/* Header */}
      <button
        className={`flex w-full items-center gap-3 px-4 py-3 ${colorClasses.bgLight} transition-colors hover:opacity-90`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Icon */}
        <div className={`shrink-0 rounded-full p-1.5 ${colorClasses.bg}`}>
          {store ? (
            <DynamicHeroIcon className="h-4 w-4 text-white" iconName={store.icon} />
          ) : (
            <div className="h-4 w-4" />
          )}
        </div>

        {/* Name and count */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold">{store?.name ?? "Unsorted"}</span>
          <span className="text-default-400 shrink-0 text-sm">
            {activeCount > 0 && <span>{activeCount}</span>}
            {doneCount > 0 && (
              <span className="text-default-300 ml-1">
                ({doneCount} done)
              </span>
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

      {/* Items */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="divide-default-100 divide-y">
              {sortedGroceries.map((grocery) => {
                const recurringGrocery = grocery.recurringGroceryId
                  ? recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null
                  : null;
                return (
                  <DraggableGroceryItem
                    key={grocery.id}
                    groceryId={grocery.id}
                    isDraggingAny={isDraggingAny}
                    onDragEnd={onDragEnd}
                    onDragStart={onDragStart}
                  >
                    <GroceryItem
                      grocery={grocery}
                      recurringGrocery={recurringGrocery}
                      store={store}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onToggle={handleToggle}
                    />
                  </DraggableGroceryItem>
                );
              })}

              {groceries.length === 0 && (
                <div className="text-default-400 px-4 py-6 text-center text-sm">
                  No items in this store
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const StoreSection = memo(StoreSectionComponent);
