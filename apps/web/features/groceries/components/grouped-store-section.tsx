"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useStructuralSharing } from "@/features/groceries/hooks/use-structural-sharing";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

import type { GroupRow } from "./dnd";
import { AisleHeading } from "./aisle-heading";
import {
  aisleContainerId,
  SortableAisleContainer,
  SortableGroupedStoreContainer,
  SortableGroupItem,
  storeGroupItems,
  UNSORTED_CONTAINER,
  useDndGroupedGroceryContext,
} from "./dnd";
import { DoneRow } from "./done-row";
import { GroupedGroceryItem } from "./grouped-grocery-item";
import { storeColorStyle } from "./store-colors";
import { StoreHeading } from "./store-heading";
import { lineOfGroup } from "./store-total";
import { useAisleBlocks } from "./use-aisle-blocks";
import { useStoreTotal } from "./use-store-total";

const NO_KEYS: string[] = [];

interface GroupedStoreSectionProps {
  store: StoreDto | null; // null = Unsorted
  groups: GroceryGroup[];
  groceries: GroceryDto[]; // Original groceries for this store (for counts)
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onToggleGroup: (ids: string[], isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
  // Every Store gets the same three, so a Store whose rows did not change does not render.
  onMarkAllDoneInStore?: (storeId: string | null) => void;
  onDeleteDoneInStore?: (storeId: string | null) => void;
  onClearAllInStore?: (storeId: string | null, storeName: string) => void;
}

/**
 * A store section that displays grouped groceries with drag-and-drop support.
 * Similar to StoreSection but renders GroceryGroup objects instead of flat items.
 * Dragging a group moves all groceries in that group together.
 */
function GroupedStoreSectionComponent({
  store,
  groups,
  groceries,
  recurringGroceries,
  onToggle,
  onToggleGroup,
  onEdit,
  onDelete: _onDelete,
  defaultExpanded = true,
  onMarkAllDoneInStore,
  onDeleteDoneInStore,
  onClearAllInStore,
}: GroupedStoreSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const t = useTranslations("groceries.store");
  const storeId = store?.id ?? null;
  const name = store?.name ?? t("unsorted");

  // The drag's arrangement while one is on; otherwise this Store's own groups, in their containers.
  const { activeGroupKey, overContainerId, arrangement } = useDndGroupedGroceryContext();
  const ownItems = useStructuralSharing(storeGroupItems(storeId, groups, store ? [store] : []));
  const ownGroups = new Map(groups.map((group) => [group.groupKey, group]));
  const items = arrangement?.items ?? ownItems;
  const groupMap = arrangement?.groups ?? ownGroups;
  const keysOf = (container: string) => items[container] ?? NO_KEYS;

  // Get container ID for this store
  const containerId = storeId ?? UNSORTED_CONTAINER;

  // Calculate counts from original groceries
  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;
  // The grouped list shows one row per group and one price on it, so the
  // heading adds up one Line Cost per group rather than per line — what is
  // under the heading is exactly what it sums.
  const priceLines = useMemo(() => groups.map(lineOfGroup), [groups]);
  const total = useStoreTotal(priceLines, store?.id ?? null);

  // Active groups of one container in DnD-ordered sequence (not done) - updates during drag
  const activeIn = useCallback(
    (container: string): GroceryGroup[] => {
      const ordered: GroceryGroup[] = [];

      for (const groupKey of items[container] ?? NO_KEYS) {
        const group = groupMap.get(groupKey);

        // Only include if it's not all done
        if (group && !group.allDone) {
          ordered.push(group);
        }
      }

      return ordered;
    },
    [items, groupMap]
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
  // There is something to show under the heading — a group, the done tail, or
  // an aisle's heading to drag into — or the card is its heading bar alone.
  const hasRows =
    isExpanded && (activeGroups.length > 0 || doneGroups.length > 0 || blocks.length > 0);
  const row: GroupRow = (group, { dragHandle, isFirst, isLast }) => (
    <GroupedGroceryItem
      dragHandle={dragHandle}
      group={group}
      isFirst={isFirst}
      isLast={isLast}
      recurringGroceries={recurringGroceries}
      onEdit={onEdit}
      onToggle={onToggle}
      onToggleGroup={onToggleGroup}
    />
  );
  const renderActive = (group: GroceryGroup) => (
    <SortableGroupItem
      key={group.groupKey}
      group={group}
      isFirst={group.groupKey === firstActiveKey}
      isLast={group.groupKey === lastActiveKey}
      row={row}
    />
  );
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
      className="relative"
      data-store-id={containerId}
      style={storeColorStyle(store?.color ?? null)}
    >
      {/* The whole section is the droppable: a drop on the heading lands in the Store */}
      <SortableGroupedStoreContainer
        activeId={activeGroupKey}
        header={headerElement}
        itemIds={keysOf(containerId)}
        overContainerId={overContainerId}
        storeId={storeId}
      >
        {/* The groups, where there is a group, a done tail or an aisle to show; otherwise the heading bar stands alone */}
        {hasRows ? (
          <div className="divide-border divide-y">
            {/* Unfiled groups first, under no heading, so they are noticed and filed */}
            {unfiled.map(renderActive)}

            {/* Every aisle of the Store, in its order, a droppable whether or not anything is filed under it */}
            {blocks.map(({ aisle, rows }) => (
              <SortableAisleContainer
                key={aisle.id}
                activeId={activeGroupKey}
                aisleId={aisle.id}
                header={<AisleHeading aisleId={aisle.id} count={rows.length} name={aisle.name} />}
                itemIds={keysOf(aisleContainerId(aisle.id))}
                overContainerId={overContainerId}
              >
                {rows.map(renderActive)}
              </SortableAisleContainer>
            ))}

            {/* The done tail, folded into one row that opens on tap; not sortable */}
            {doneGroups.length > 0 && (
              <DoneRow count={doneGroups.length}>
                {doneGroups.map((group, index) => (
                  <GroupedGroceryItem
                    key={group.groupKey}
                    group={group}
                    isLast={index === doneGroups.length - 1}
                    recurringGroceries={recurringGroceries}
                    onEdit={onEdit}
                    onToggle={onToggle}
                    onToggleGroup={onToggleGroup}
                  />
                ))}
              </DoneRow>
            )}
          </div>
        ) : null}
      </SortableGroupedStoreContainer>
    </motion.div>
  );
}
export const GroupedStoreSection = memo(GroupedStoreSectionComponent);
