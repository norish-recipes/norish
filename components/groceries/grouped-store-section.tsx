"use client";

import type { GroceryDto, StoreDto, StoreColor, RecurringGroceryDto } from "@/types";
import type { GroceryGroup } from "@/lib/grocery-grouping";

import { memo, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  ChevronDownIcon,
  EllipsisVerticalIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { GroupedGroceryItem } from "./grouped-grocery-item";
import { DynamicHeroIcon } from "./dynamic-hero-icon";
import { getStoreColorClasses } from "./store-colors";
import {
  SortableGroupedStoreContainer,
  SortableGroupItem,
  useDndGroupedGroceryContext,
} from "./dnd";

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
  const { getGroupKeysForContainer } = useDndGroupedGroceryContext();

  // Get container ID for this store
  const containerId = store?.id ?? "unsorted";

  const colorClasses = store
    ? getStoreColorClasses(store.color as StoreColor)
    : {
        bg: "bg-default-400",
        bgLight: "bg-default-100",
        text: "text-default-500",
        border: "border-default-300",
        ring: "ring-default-400",
      };

  // Calculate counts from original groceries
  const activeCount = groceries.filter((g) => !g.isDone).length;
  const doneCount = groceries.filter((g) => g.isDone).length;

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

  // Get ordered group keys from DnD context - this updates during drag
  const orderedGroupKeys = getGroupKeysForContainer(containerId);

  // Active groups in DnD-ordered sequence (not done)
  const activeGroups = useMemo(() => {
    const ordered: GroceryGroup[] = [];

    for (const groupKey of orderedGroupKeys) {
      const group = groupMap.get(groupKey);

      // Only include if it's not all done
      if (group && !group.allDone) {
        ordered.push(group);
      }
    }

    return ordered;
  }, [orderedGroupKeys, groupMap]);

  // Done groups - sorted by sortOrder, not draggable
  const doneGroups = useMemo(() => {
    return groups.filter((g) => g.allDone);
  }, [groups]);

  // Header element - passed to SortableGroupedStoreContainer so it's part of droppable area
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
    <motion.div className="relative" data-store-id={store?.id ?? "unsorted"}>
      {/* Entire section wrapped in SortableGroupedStoreContainer - header + groups are droppable */}
      <SortableGroupedStoreContainer
        header={headerElement}
        headerBgClass={colorClasses.bgLight}
        storeId={store?.id ?? null}
      >
        {/* Groups area - only shown when expanded */}
        {isExpanded ? (
          <div className="divide-default-100 divide-y">
            {/* Active (not done) groups - sortable */}
            {activeGroups.map((group, index) => {
              const isFirst = index === 0;
              const isLast = index === activeGroups.length - 1 && doneGroups.length === 0;

              return (
                <SortableGroupItem key={group.groupKey} group={group}>
                  {({ dragHandle }) => (
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
                  )}
                </SortableGroupItem>
              );
            })}

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

            {/* Empty state */}
            {activeGroups.length === 0 && doneGroups.length === 0 && (
              <div className="text-default-400 px-4 py-6 text-center text-sm">{t("noItems")}</div>
            )}
          </div>
        ) : null}
      </SortableGroupedStoreContainer>
    </motion.div>
  );
}

export const GroupedStoreSection = memo(GroupedStoreSectionComponent);
