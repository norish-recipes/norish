"use client";

import type { GroceryDto, StoreDto, StoreColor, RecurringGroceryDto } from "@/types";

import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { GroceryItem } from "./grocery-item";
import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { getStoreColorClasses } from "./store-colors";
import {
  SortableStoreContainer,
  SortableGroceryItem,
  useDndGroceryContext,
  UNSORTED_CONTAINER,
} from "./dnd";

interface StoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  /** Groceries that belong to this store (for counting, done items, etc.) */
  groceries: GroceryDto[];
  /** All groceries across all stores - needed to render items dragged from other stores */
  allGroceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  onMarkAllDone?: () => void;
  onDeleteDone?: () => void;
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
}

// Delay before reordering after toggle (ms)
const REORDER_DELAY = 600;

function StoreSectionComponent({
  store,
  groceries,
  allGroceries,
  recurringGroceries,
  onToggle,
  onEdit,
  onDelete,
  defaultExpanded = true,
  onMarkAllDone,
  onDeleteDone,
  getRecipeNameForGrocery,
}: StoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("groceries.store");

  // Get DnD context for ordered items and drag state
  const { activeId: _activeId, getItemsForContainer } = useDndGroceryContext();

  // Get container ID for this store
  const containerId = store?.id ?? UNSORTED_CONTAINER;

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
      };

  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;

  // Get ordered item IDs from DnD context - this updates during drag
  const orderedItemIds = getItemsForContainer(containerId);

  // Build a map for quick grocery lookup - uses ALL groceries so we can
  // render items that are dragged from other stores during drag operations
  const groceryMap = useMemo(() => {
    const map = new Map<string, GroceryDto>();

    for (const g of allGroceries) {
      map.set(g.id, g);
    }

    return map;
  }, [allGroceries]);

  // Active groceries in DnD-ordered sequence
  const activeGroceries = useMemo(() => {
    // Use DnD context order
    const ordered: GroceryDto[] = [];

    for (const id of orderedItemIds) {
      const grocery = groceryMap.get(id);

      // Only include if it's not done and not transitioning
      if (grocery && !grocery.isDone && !transitioningIds.has(grocery.id)) {
        ordered.push(grocery);
      }
    }

    return ordered;
  }, [orderedItemIds, groceryMap, transitioningIds]);

  // Done groceries (including transitioning) - sorted by sortOrder
  const doneGroceries = useMemo(() => {
    return groceries
      .filter((g) => g.isDone || transitioningIds.has(g.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [groceries, transitioningIds]);

  // Header element - passed to SortableStoreContainer so it's part of droppable area
  const headerElement = (
    <div
      className={`flex w-full items-center gap-3 px-4 py-3 ${colorClasses.bgLight} rounded-t-xl`}
      data-store-drop-target={store?.id ?? "unsorted"}
    >
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
          <span className="truncate font-semibold">{store?.name ?? t("unsorted")}</span>
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

      {/* Bulk actions dropdown */}
      {groceries.length > 0 && (
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly className="shrink-0" size="sm" variant="light">
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={t("storeActions")}>
            <DropdownItem
              key="mark-done"
              startContent={<CheckIcon className="h-4 w-4" />}
              onPress={() => onMarkAllDone?.()}
            >
              {t("markAllDone")}
            </DropdownItem>
            <DropdownItem
              key="delete-done"
              className="text-danger"
              color="danger"
              startContent={<TrashIcon className="h-4 w-4" />}
              onPress={() => onDeleteDone?.()}
            >
              {t("deleteDone")}
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      )}
    </div>
  );

  return (
    <motion.div ref={sectionRef} className="relative" data-store-id={store?.id ?? "unsorted"}>
      {/* Entire section wrapped in SortableStoreContainer - header + items are droppable */}
      <SortableStoreContainer
        header={headerElement}
        headerBgClass={colorClasses.bgLight}
        storeId={store?.id ?? null}
      >
        {/* Items area - only shown when expanded */}
        {isExpanded ? (
          <div className="divide-default-100 divide-y">
            {/* Active (not done) items - sortable */}
            {activeGroceries.map((grocery, index) => {
              const recurringGrocery = grocery.recurringGroceryId
                ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
                : null;
              const isFirst = index === 0;
              const isLast = index === activeGroceries.length - 1 && doneGroceries.length === 0;

              return (
                <SortableGroceryItem key={grocery.id} grocery={grocery}>
                  <GroceryItem
                    grocery={grocery}
                    isFirst={isFirst}
                    isLast={isLast}
                    recipeName={getRecipeNameForGrocery?.(grocery)}
                    recurringGrocery={recurringGrocery}
                    store={store}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onToggle={handleToggle}
                  />
                </SortableGroceryItem>
              );
            })}

            {/* Done items - not sortable, just rendered */}
            {doneGroceries.map((grocery, index) => {
              const recurringGrocery = grocery.recurringGroceryId
                ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
                : null;
              const isFirst = index === 0 && activeGroceries.length === 0;
              const isLast = index === doneGroceries.length - 1;

              return (
                <div key={grocery.id}>
                  <GroceryItem
                    grocery={grocery}
                    isFirst={isFirst}
                    isLast={isLast}
                    recipeName={getRecipeNameForGrocery?.(grocery)}
                    recurringGrocery={recurringGrocery}
                    store={store}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onToggle={handleToggle}
                  />
                </div>
              );
            })}

            {/* Empty state - only show when no items AND no items being dragged here */}
            {activeGroceries.length === 0 && doneGroceries.length === 0 && (
              <div className="text-default-400 px-4 py-6 text-center text-sm">{t("noItems")}</div>
            )}
          </div>
        ) : null}
      </SortableStoreContainer>
    </motion.div>
  );
}

export const StoreSection = memo(StoreSectionComponent);
