"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import { AisleHeading, DoneHeading } from "./aisle-heading";
import {
  aisleContainerId,
  SortableAisleContainer,
  SortableGroupedStoreContainer,
  SortableGroupItem,
  useDndGroupedGroceryContext,
} from "./dnd";
import { GroupedGroceryItem } from "./grouped-grocery-item";
import { storeColorStyle } from "./store-colors";
import { StoreHeading } from "./store-heading";
import { StoreHeadingTotal } from "./store-heading-total";
import { lineOfGroup } from "./store-total";
import { useAisleBlocks } from "./use-aisle-blocks";

interface GroupedStoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  groups: GroceryGroup[];
  /** All groups across all stores - needed to render groups dragged from other stores */
  allGroups: Map<string | null, GroceryGroup[]>;
  groceries: GroceryDto[]; // Original groceries for this store (for counts)
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onToggleGroup: (ids: string[], isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  onMarkAllDone?: () => void;
  onDeleteDone?: () => void;
}

/**
 * A store section that displays grouped groceries with drag-and-drop support.
 * Similar to StoreSection but renders GroceryGroup objects instead of flat items.
 * Dragging a group moves all groceries in that group together.
 */
function GroupedStoreSectionComponent({
  store,
  groups,
  allGroups,
  groceries,
  recurringGroceries,
  onToggle,
  onToggleGroup,
  onEdit,
  onDelete: _onDelete,
  defaultExpanded = true,
  onMarkAllDone,
  onDeleteDone,
}: GroupedStoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const t = useTranslations("groceries.store");

  // Get DnD context for ordered group keys
  const { activeGroupKey, overContainerId, getGroupKeysForContainer } =
    useDndGroupedGroceryContext();

  // Get container ID for this store
  const containerId = store?.id ?? "unsorted";
  // The Store's colour is one property on its section; Unsorted has none.
  const headerTint = store ? "bg-(--store-color)/10" : "bg-surface-secondary";

  // Calculate counts from original groceries
  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;
  // The grouped list shows one row per group and one price on it, so the
  // heading adds up one Line Cost per group rather than per line — what is
  // under the heading is exactly what it sums.
  const priceLines = useMemo(() => groups.map(lineOfGroup), [groups]);

  // Build a map for quick group lookup - uses ALL groups so we can
  // render groups that are dragged from other stores during drag operations
  const groupMap = useMemo(() => {
    const map = new Map<string, GroceryGroup>();
    for (const storeGroups of allGroups.values()) {
      for (const group of storeGroups) {
        map.set(group.groupKey, group);
      }
    }
    return map;
  }, [allGroups]);

  // Active groups of one container in DnD-ordered sequence (not done) - updates during drag
  const activeIn = useCallback(
    (container: string): GroceryGroup[] => {
      const ordered: GroceryGroup[] = [];

      for (const groupKey of getGroupKeysForContainer(container)) {
        const group = groupMap.get(groupKey);

        // Only include if it's not all done
        if (group && !group.allDone) {
          ordered.push(group);
        }
      }

      return ordered;
    },
    [getGroupKeysForContainer, groupMap]
  );

  // Done groups - sorted by sortOrder, not draggable
  const doneGroups = useMemo(() => {
    return groups.filter((g) => g.allDone);
  }, [groups]);

  // The block's shape, read off the drag state; a group is per aisle per Store (ADR-0031).
  const {
    unfiled,
    blocks,
    active: activeGroups,
  } = useAisleBlocks(containerId, store?.aisles, activeIn);
  const firstActiveKey = activeGroups[0]?.groupKey;
  const lastActiveKey = doneGroups.length === 0 ? activeGroups.at(-1)?.groupKey : undefined;
  const renderActive = (group: GroceryGroup) => (
    <SortableGroupItem key={group.groupKey} group={group}>
      {({ dragHandle }) => (
        <GroupedGroceryItem
          dragHandle={dragHandle}
          group={group}
          isFirst={group.groupKey === firstActiveKey}
          isLast={group.groupKey === lastActiveKey}
          recurringGroceries={recurringGroceries}
          onEdit={onEdit}
          onToggle={onToggle}
          onToggleGroup={onToggleGroup}
        />
      )}
    </SortableGroupItem>
  );

  // The heading, handed to the container so a drop on it lands in the Store
  const headerElement = (
    <StoreHeading
      actions={groceries.length > 0 ? { onMarkAllDone, onDeleteDone } : undefined}
      activeCount={activeCount}
      className={headerTint}
      doneCount={doneCount}
      dot={store !== null}
      dropTarget={store?.id ?? "unsorted"}
      expanded={isExpanded}
      name={store?.name ?? t("unsorted")}
      total={<StoreHeadingTotal lines={priceLines} storeId={store?.id ?? null} />}
      onExpandedChange={setIsExpanded}
    />
  );
  return (
    <motion.div
      className="relative"
      data-store-id={store?.id ?? "unsorted"}
      style={store ? storeColorStyle(store.color) : undefined}
    >
      {/* Entire section wrapped in SortableGroupedStoreContainer - header + groups are droppable */}
      <SortableGroupedStoreContainer
        header={headerElement}
        headerBgClass={headerTint}
        storeId={store?.id ?? null}
      >
        {/* Groups area - only shown when expanded */}
        {isExpanded ? (
          <div className="divide-border divide-y">
            {/* Unfiled groups first, under no heading, so they are noticed and filed */}
            {unfiled.map(renderActive)}

            {/* Every aisle of the Store, in its order, a droppable whether or not anything is filed under it */}
            {blocks.map(({ aisle, rows }) => (
              <SortableAisleContainer
                key={aisle.id}
                activeId={activeGroupKey}
                aisleId={aisle.id}
                header={
                  <AisleHeading aisleId={aisle.id} empty={rows.length === 0} name={aisle.name} />
                }
                itemIds={getGroupKeysForContainer(aisleContainerId(aisle.id))}
                overContainerId={overContainerId}
              >
                {rows.map(renderActive)}
              </SortableAisleContainer>
            ))}

            {/* The done tail, said so where aisle headings would otherwise claim it */}
            {blocks.length > 0 && doneGroups.length > 0 && <DoneHeading />}

            {/* Done groups - not sortable, just rendered */}
            {doneGroups.map((group, index) => {
              const isFirst = index === 0 && activeGroups.length === 0;
              const isLast = index === doneGroups.length - 1;
              return (
                <div key={group.groupKey}>
                  <GroupedGroceryItem
                    group={group}
                    isFirst={isFirst}
                    isLast={isLast}
                    recurringGroceries={recurringGroceries}
                    onEdit={onEdit}
                    onToggle={onToggle}
                    onToggleGroup={onToggleGroup}
                  />
                </div>
              );
            })}

            {/* Empty state - only when nothing is here and the Store has no aisles to show its shape */}
            {activeGroups.length === 0 && doneGroups.length === 0 && blocks.length === 0 && (
              <div className="text-muted px-4 py-6 text-center text-sm">{t("noItems")}</div>
            )}
          </div>
        ) : null}
      </SortableGroupedStoreContainer>
    </motion.div>
  );
}
export const GroupedStoreSection = memo(GroupedStoreSectionComponent);
