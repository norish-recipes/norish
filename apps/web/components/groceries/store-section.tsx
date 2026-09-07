"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type {
  GroceryDto,
  RecurringGroceryDto,
  StoreColor,
  StoreDto,
} from "@norish/shared/contracts";

import { AisleHeading } from "./aisle-heading";
import {
  aisleContainerId,
  SortableAisleContainer,
  SortableGroceryItem,
  SortableStoreContainer,
  UNSORTED_CONTAINER,
  useDndGroceryContext,
} from "./dnd";
import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { GroceryItem } from "./grocery-item";
import { getStoreColorClasses } from "./store-colors";
import { StoreHeadingTotal } from "./store-heading-total";
import { lineOf } from "./store-total";

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
  const { activeId, overContainerId, getItemsForContainer } = useDndGroceryContext();

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
        bg: "bg-muted",
        bgLight: "bg-surface-secondary",
        text: "text-muted",
        border: "border-border-secondary",
        ring: "ring-border",
      };
  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;
  // The flat list prices every row as its own purchase.
  const priceLines = useMemo(() => groceries.map(lineOf), [groceries]);

  // Build a map for quick grocery lookup - uses ALL groceries so we can
  // render items that are dragged from other stores during drag operations
  const groceryMap = useMemo(() => {
    const map = new Map<string, GroceryDto>();
    for (const g of allGroceries) {
      map.set(g.id, g);
    }
    return map;
  }, [allGroceries]);

  // Active groceries of one container in DnD-ordered sequence - updates during drag
  const activeIn = useCallback(
    (container: string): GroceryDto[] => {
      const ordered: GroceryDto[] = [];

      for (const id of getItemsForContainer(container)) {
        const grocery = groceryMap.get(id);

        // Only include if it's not done and not transitioning
        if (grocery && !grocery.isDone && !transitioningIds.has(grocery.id)) {
          ordered.push(grocery);
        }
      }

      return ordered;
    },
    [getItemsForContainer, groceryMap, transitioningIds]
  );

  // The block's shape: unfiled rows first, under no heading, then every aisle
  // of the Store in its order, filled or not. A row's aisle is what its Store
  // files its name under, which the drag state was built from (ADR-0031).
  const aisles = store?.aisles;
  const { unfiled, blocks, activeGroceries } = useMemo(() => {
    const unfiledRows = activeIn(containerId);
    const aisleBlocks = (aisles ?? []).map((aisle) => ({
      aisle,
      rows: activeIn(aisleContainerId(aisle.id)),
    }));

    return {
      unfiled: unfiledRows,
      blocks: aisleBlocks,
      activeGroceries: [...unfiledRows, ...aisleBlocks.flatMap((block) => block.rows)],
    };
  }, [activeIn, containerId, aisles]);

  // Done groceries (including transitioning) - sorted by sortOrder
  const doneGroceries = useMemo(() => {
    return groceries
      .filter((g) => g.isDone || transitioningIds.has(g.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [groceries, transitioningIds]);

  const firstActiveId = activeGroceries[0]?.id;
  const lastActiveId = doneGroceries.length === 0 ? activeGroceries.at(-1)?.id : undefined;
  const renderActive = (grocery: GroceryDto) => {
    const recurringGrocery = grocery.recurringGroceryId
      ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
      : null;

    return (
      <SortableGroceryItem key={grocery.id} grocery={grocery}>
        <GroceryItem
          grocery={grocery}
          isFirst={grocery.id === firstActiveId}
          isLast={grocery.id === lastActiveId}
          recipeName={getRecipeNameForGrocery?.(grocery)}
          recurringGrocery={recurringGrocery}
          store={store}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggle={handleToggle}
        />
      </SortableGroceryItem>
    );
  };

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
          <span className="text-muted shrink-0 text-sm">
            {activeCount > 0 && <span>{activeCount}</span>}
            {doneCount > 0 && (
              <span className="text-muted ml-1">
                (
                {t("done", {
                  count: doneCount,
                })}
                )
              </span>
            )}
          </span>
        </div>

        {/* What is still to buy at this Store costs this */}
        <StoreHeadingTotal lines={priceLines} storeId={store?.id ?? null} />

        {/* Expand/collapse chevron */}
        <motion.div
          animate={{
            rotate: isExpanded ? 180 : 0,
          }}
          className="text-muted shrink-0"
          transition={{
            duration: 0.2,
          }}
        >
          <ChevronDownIcon className="h-5 w-5" />
        </motion.div>
      </button>

      {/* Bulk actions dropdown */}
      {groceries.length > 0 && (
        <Dropdown>
          <Button isIconOnly className="shrink-0" size="sm" variant="tertiary">
            <EllipsisVerticalIcon className="h-5 w-5" />
          </Button>
          <Dropdown.Popover className="bg-overlay">
            <Dropdown.Menu aria-label={t("storeActions")}>
              <Dropdown.Item
                id="mark-done"
                key="mark-done"
                textValue={t("markAllDone")}
                onPress={() => onMarkAllDone?.()}
              >
                {<CheckIcon className="h-4 w-4" />}
                <Label>{t("markAllDone")}</Label>
              </Dropdown.Item>
              <Dropdown.Item
                id="delete-done"
                key="delete-done"
                className="text-danger"
                textValue={t("deleteDone")}
                onPress={() => onDeleteDone?.()}
                variant="danger"
              >
                {<TrashIcon className="h-4 w-4" />}
                <Label>{t("deleteDone")}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
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
          <div className="divide-border divide-y">
            {/* Unfiled rows first, under no heading, so they are noticed and filed */}
            {unfiled.map(renderActive)}

            {/* Every aisle of the Store, in its order, a droppable whether or not anything is filed under it */}
            {blocks.map(({ aisle, rows }) => (
              <SortableAisleContainer
                key={aisle.id}
                activeId={activeId}
                aisleId={aisle.id}
                header={
                  <AisleHeading aisleId={aisle.id} empty={rows.length === 0} name={aisle.name} />
                }
                itemIds={getItemsForContainer(aisleContainerId(aisle.id))}
                overContainerId={overContainerId}
              >
                {rows.map(renderActive)}
              </SortableAisleContainer>
            ))}

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

            {/* Empty state - only when nothing is here and the Store has no aisles to show its shape */}
            {activeGroceries.length === 0 && doneGroceries.length === 0 && blocks.length === 0 && (
              <div className="text-muted px-4 py-6 text-center text-sm">{t("noItems")}</div>
            )}
          </div>
        ) : null}
      </SortableStoreContainer>
    </motion.div>
  );
}
export const StoreSection = memo(StoreSectionComponent);
