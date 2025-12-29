"use client";

import type { GroceryDto, StoreDto, StoreColor, RecurringGroceryDto } from "@/types";

import { memo, useState, useCallback, useRef, useEffect } from "react";
import { motion, Reorder } from "motion/react";
import { ChevronDownIcon, EllipsisVerticalIcon, CheckIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";

import { GroceryItem } from "./grocery-item";
import { DraggableGroceryStoreItem } from "./draggable-grocery-store-item";
import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { getStoreColorClasses } from "./store-colors";

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

interface StoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  isDraggingAny: boolean;
  onDragStart?: (groceryId: string) => void;
  onDragEnd?: (pointerPosition: { x: number; y: number }) => void;
  onReorderInStore?: (updates: { id: string; sortOrder: number }[], backendOnly?: boolean) => void;
  onDraggingInSection?: (isDragging: boolean) => void;
  onMarkAllDone?: () => void;
  onDeleteDone?: () => void;
}

// Delay before reordering after toggle (ms)
const REORDER_DELAY = 600;

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
  onReorderInStore,
  onDraggingInSection,
  onMarkAllDone,
  onDeleteDone,
}: StoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);
  const dragConstraintsRef = useRef<HTMLDivElement>(null);
  const [isHoveringForDrop, setIsHoveringForDrop] = useState(false);
  const [hasDraggingItem, setHasDraggingItem] = useState(false);
  
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

  // Track hover state for drop zone visual feedback
  useEffect(() => {
    if (!isDraggingAny) {
      setIsHoveringForDrop(false);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      setIsHoveringForDrop(isInside);
    };

    const handlePointerUp = () => {
      setIsHoveringForDrop(false);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingAny]);

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
        label: "Auto detect from history",
      };

  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;

  // Handle reordering of items - updates visual order immediately
  const handleReorder = useCallback(
    (newOrder: GroceryDto[]) => {
      if (!onReorderInStore) return;

      // Filter out any items that don't belong to this store
      const storeId = store?.id ?? null;
      const validItems = newOrder.filter((grocery) => grocery.storeId === storeId);
      
      if (validItems.length === 0) return;

      // Create updates with new sort order
      const updates = validItems.map((grocery, index) => ({
        id: grocery.id,
        sortOrder: index,
      }));
      
      // Update optimistically (visual only, backend called on drag end)
      onReorderInStore(updates, false);
    },
    [onReorderInStore, store]
  );

  // Sort groceries using helper function
  const sortedGroceries = sortGroceries(groceries, transitioningIds);

  return (
    <motion.div
      ref={sectionRef}
      animate={{
        scale: isHoveringForDrop ? 0.98 : 1,
      }}
      className="relative"
      data-store-id={store?.id ?? "unsorted"}
      style={{ zIndex: hasDraggingItem ? 50 : 1 }}
      transition={{ duration: 0.15 }}
    >
      <div className={`rounded-xl transition-all duration-200 ${isDraggingAny ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* Header */}
      <div className={`flex w-full items-center gap-3 px-4 py-3 ${colorClasses.bgLight}`} data-store-drop-target={store?.id ?? 'unsorted'}>
        <button
          className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:opacity-90"
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

        {/* Bulk actions dropdown */}
        {groceries.length > 0 && (
          <Dropdown>
            <DropdownTrigger>
              <Button
                isIconOnly
                className="shrink-0"
                size="sm"
                variant="light"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Store actions">
              <DropdownItem
                key="mark-done"
                startContent={<CheckIcon className="h-4 w-4" />}
                onPress={() => onMarkAllDone?.()}
              >
                Mark all done
              </DropdownItem>
              <DropdownItem
                key="delete-done"
                className="text-danger"
                color="danger"
                startContent={<TrashIcon className="h-4 w-4" />}
                onPress={() => onDeleteDone?.()}
              >
                Delete done
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        )}
      </div>

      {/* Items */}
      {isExpanded && (
        <div ref={dragConstraintsRef} className="divide-default-100 divide-y">
          {/* Active (not done) items - sortable */}
          <Reorder.Group
            axis="y"
            className="divide-default-100 divide-y"
            values={sortedGroceries.filter((g) => !g.isDone && !transitioningIds.has(g.id))}
            onReorder={handleReorder}
          >
            {sortedGroceries
              .filter((g) => !g.isDone && !transitioningIds.has(g.id))
              .map((grocery, index, array) => {
                const recurringGrocery = grocery.recurringGroceryId
                  ? recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null
                  : null;
                const isFirst = index === 0;
                const isLast = index === array.length - 1;
                return (
                  <DraggableGroceryStoreItem
                    key={grocery.id}
                    grocery={grocery}
                    onDragEnd={(pointerPosition: { x: number; y: number }) => {
                      setHasDraggingItem(false);
                      onDraggingInSection?.(false);
                      onDragEnd?.(pointerPosition);
                    }}
                    onDragStart={(groceryId: string) => {
                      setHasDraggingItem(true);
                      onDraggingInSection?.(true);
                      onDragStart?.(groceryId);
                    }}
                  >
                    <GroceryItem
                      grocery={grocery}
                      recurringGrocery={recurringGrocery}
                      store={store}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onToggle={handleToggle}
                      isFirst={isFirst}
                      isLast={isLast}
                    />
                  </DraggableGroceryStoreItem>
                );
              })}
          </Reorder.Group>

          {/* Done items - not sortable, just rendered */}
          {sortedGroceries
            .filter((g) => g.isDone || transitioningIds.has(g.id))
            .map((grocery, index, array) => {
              const recurringGrocery = grocery.recurringGroceryId
                ? recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null
                : null;
              const isFirst = index === 0;
              const isLast = index === array.length - 1;
              return (
                <div key={grocery.id}>
                  <GroceryItem
                    grocery={grocery}
                    recurringGrocery={recurringGrocery}
                    store={store}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onToggle={handleToggle}
                    isFirst={isFirst}
                    isLast={isLast}
                  />
                </div>
              );
            })}

          {groceries.length === 0 && (
            <div className="text-default-400 px-4 py-6 text-center text-sm">
              No items in this store
            </div>
          )}
        </div>
      )}
      </div>

      {/* Border overlay when hovering for drop */}
      {isHoveringForDrop && (
        <motion.div
          animate={{ opacity: 1 }}
          className={`pointer-events-none absolute inset-0 z-10 rounded-xl border-2 ${colorClasses.border}`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        />
      )}
    </motion.div>
  );
}

export const StoreSection = memo(StoreSectionComponent);
