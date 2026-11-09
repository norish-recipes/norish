"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStructuralSharing } from "@/features/groceries/hooks/use-structural-sharing";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";

import type { AisleResolver } from "./dnd";
import { AisleHeading } from "./aisle-heading";
import {
  aisleContainerId,
  SortableAisleContainer,
  SortableGroceryItem,
  SortableStoreContainer,
  storeItems,
  UNSORTED_CONTAINER,
  useDndGroceryContext,
} from "./dnd";
import { DoneRow } from "./done-row";
import { GroceryItem } from "./grocery-item";
import { storeColorStyle } from "./store-colors";
import { StoreHeading } from "./store-heading";
import { lineOf } from "./store-total";
import { useAisleBlocks } from "./use-aisle-blocks";
import { useStoreTotal } from "./use-store-total";

interface StoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  /** Groceries that belong to this store (for counting, done items, etc.) */
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  /** Where each Store files each name, which says the aisle each row sits under. */
  aisleFor: AisleResolver;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  // Every Store gets the same three, so a Store whose rows did not change does not render.
  onMarkAllDoneInStore?: (storeId: string | null) => void;
  onDeleteDoneInStore?: (storeId: string | null) => void;
  onClearAllInStore?: (storeId: string | null, storeName: string) => void;
  getRecipeNameForGrocery?: (grocery: GroceryDto) => string | null;
}

// Delay before reordering after toggle (ms)
const REORDER_DELAY = 600;

const NO_KEYS: string[] = [];

function StoreSectionComponent({
  store,
  groceries,
  recurringGroceries,
  aisleFor,
  onToggle,
  onEdit,
  onDelete,
  defaultExpanded = true,
  onMarkAllDoneInStore,
  onDeleteDoneInStore,
  onClearAllInStore,
  getRecipeNameForGrocery,
}: StoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("groceries.store");
  const storeId = store?.id ?? null;
  const name = store?.name ?? t("unsorted");

  // The drag's arrangement while one is on; otherwise this Store's own rows, in their containers.
  const { activeId, overContainerId, arrangement } = useDndGroceryContext();
  const ownItems = useStructuralSharing(
    storeItems(storeId, groceries, store ? [store] : [], aisleFor)
  );
  const ownRows = new Map(groceries.map((grocery) => [grocery.id, grocery]));
  const items = arrangement?.items ?? ownItems;
  const groceryMap = arrangement?.byKey ?? ownRows;
  const keysOf = (container: string) => items[container] ?? NO_KEYS;

  // Get container ID for this store
  const containerId = storeId ?? UNSORTED_CONTAINER;

  // Track items that are transitioning (just toggled) - delay their reorder
  const [transitioningIds, setTransitioningIds] = useState<Set<string>>(() => new Set());
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;

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
        const existingTimeout = timeoutsRef.current.get(id);

        if (existingTimeout) clearTimeout(existingTimeout);

        // Remove from transitioning after delay
        const timeout = setTimeout(() => {
          setTransitioningIds((prev) => {
            const next = new Set(prev);

            next.delete(id);

            return next;
          });
          timeoutsRef.current.delete(id);
        }, REORDER_DELAY);

        timeoutsRef.current.set(id, timeout);
      }
    },
    [onToggle]
  );
  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;
  // The flat list prices every row as its own purchase.
  const priceLines = useMemo(() => groceries.map(lineOf), [groceries]);
  const total = useStoreTotal(priceLines, store?.id ?? null);

  // Active groceries of one container in DnD-ordered sequence - updates during drag
  const activeIn = useCallback(
    (container: string): GroceryDto[] => {
      const ordered: GroceryDto[] = [];

      for (const id of items[container] ?? NO_KEYS) {
        const grocery = groceryMap.get(id);

        // Only include if it's not done and not transitioning
        if (grocery && !grocery.isDone && !transitioningIds.has(grocery.id)) {
          ordered.push(grocery);
        }
      }

      return ordered;
    },
    [items, groceryMap, transitioningIds]
  );

  // Done groceries (including transitioning) - sorted by sortOrder
  const doneGroceries = useMemo(() => {
    return groceries
      .filter((g) => g.isDone || transitioningIds.has(g.id))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [groceries, transitioningIds]);

  // The block's shape, read off the drag state (ADR-0031).
  const {
    unfiled,
    blocks,
    active: activeGroceries,
  } = useAisleBlocks(containerId, store?.aisles, activeIn);
  const firstActiveId = activeGroceries[0]?.id;
  const lastActiveId = doneGroceries.length === 0 ? activeGroceries.at(-1)?.id : undefined;
  // There is something to show under the heading — a row, the done tail, or an
  // aisle's heading to drag into — or the card is its heading bar alone.
  const hasRows =
    isExpanded && (activeGroceries.length > 0 || doneGroceries.length > 0 || blocks.length > 0);
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

  const actions = {
    onMarkAllDone: onMarkAllDoneInStore && (() => onMarkAllDoneInStore(storeId)),
    onDeleteDone: onDeleteDoneInStore && (() => onDeleteDoneInStore(storeId)),
    onClearAll: onClearAllInStore && (() => onClearAllInStore(storeId, name)),
  };

  // The heading, handed to the container so a drop on it lands in the Store
  const headerElement = (
    <StoreHeading
      actions={groceries.length > 0 ? actions : undefined}
      activeCount={activeCount}
      doneCount={doneCount}
      dot={store !== null}
      dropTarget={containerId}
      expanded={isExpanded}
      name={name}
      total={total}
      onExpandedChange={setIsExpanded}
    />
  );

  return (
    <motion.div
      ref={sectionRef}
      className="relative"
      data-store-id={containerId}
      style={storeColorStyle(store?.color ?? null)}
    >
      {/* The whole section is the droppable: a drop on the heading lands in the Store */}
      <SortableStoreContainer
        activeId={activeId}
        header={headerElement}
        itemIds={keysOf(containerId)}
        overContainerId={overContainerId}
        storeId={storeId}
      >
        {/* The rows, where there is a row, a done tail or an aisle to show; otherwise the heading bar stands alone */}
        {hasRows ? (
          <div className="divide-border divide-y">
            {/* Unfiled rows first, under no heading, so they are noticed and filed */}
            {unfiled.map(renderActive)}

            {/* Every aisle of the Store, in its order, a droppable whether or not anything is filed under it */}
            {blocks.map(({ aisle, rows }) => (
              <SortableAisleContainer
                key={aisle.id}
                activeId={activeId}
                aisleId={aisle.id}
                header={<AisleHeading aisleId={aisle.id} count={rows.length} name={aisle.name} />}
                itemIds={keysOf(aisleContainerId(aisle.id))}
                overContainerId={overContainerId}
              >
                {rows.map(renderActive)}
              </SortableAisleContainer>
            ))}

            {/* The done tail, folded into one row that opens on tap; not sortable */}
            {doneGroceries.length > 0 && (
              <DoneRow count={doneGroceries.length}>
                {doneGroceries.map((grocery, index) => {
                  const recurringGrocery = grocery.recurringGroceryId
                    ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
                    : null;

                  return (
                    <GroceryItem
                      key={grocery.id}
                      grocery={grocery}
                      isLast={index === doneGroceries.length - 1}
                      recipeName={getRecipeNameForGrocery?.(grocery)}
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
        ) : null}
      </SortableStoreContainer>
    </motion.div>
  );
}
export const StoreSection = memo(StoreSectionComponent);
