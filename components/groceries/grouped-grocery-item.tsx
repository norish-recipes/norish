"use client";

import type { GroceryDto, RecurringGroceryDto } from "@/types";
import type { GroceryGroup, GroupedGrocerySource } from "@/lib/grocery-grouping";
import type { ReactNode } from "react";

import { memo, useState, useCallback } from "react";
import { Checkbox } from "@heroui/react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { motion, AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import { RecurrencePill } from "@/app/(app)/groceries/components/recurrence-pill";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";

/**
 * Format inline source breakdown showing recipe names and amounts.
 * e.g., "Recipe A (300g), Recipe B (200g)" or "Recipe A, Recipe B"
 */
function formatInlineSourceBreakdown(
  sources: GroupedGrocerySource[],
  formatFn: (amount: number | null | undefined, unit: string | null | undefined) => string
): string {
  return sources
    .map((source) => {
      const name = source.recipeName ?? "Manual";
      const amount = formatFn(source.grocery.amount, source.grocery.unit);

      return amount ? `${name} (${amount})` : name;
    })
    .join(", ");
}

interface GroupedGroceryItemProps {
  group: GroceryGroup;
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onToggleGroup: (ids: string[], isDone: boolean) => void;
  isFirst?: boolean;
  isLast?: boolean;
  dragHandle?: ReactNode;
}

/**
 * Renders a grouped grocery item with expandable recipe breakdown.
 *
 * When collapsed: Shows aggregated total (e.g., "500g kipfilet")
 * When expanded: Shows individual sources with recipe names
 */
function GroupedGroceryItemComponent({
  group,
  recurringGroceries,
  onToggle,
  onEdit,
  onToggleGroup,
  isFirst = false,
  isLast = false,
  dragHandle,
}: GroupedGroceryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = useTranslations("groceries.item");
  const { formatAmountUnit } = useUnitFormatter();

  const roundedClass =
    isFirst && isLast ? "rounded-lg" : isFirst ? "rounded-t-lg" : isLast ? "rounded-b-lg" : "";

  // Only show as single item if there's only one source
  const isSingleItem = group.sources.length === 1;

  // Toggle all items in group
  const handleGroupToggle = useCallback(
    (checked: boolean) => {
      const ids = group.sources.map((s) => s.grocery.id);

      onToggleGroup(ids, checked);
    },
    [group.sources, onToggleGroup]
  );

  // Toggle expansion
  const handleExpandClick = useCallback(() => {
    if (!isSingleItem) {
      setIsExpanded(!isExpanded);
    }
  }, [isSingleItem, isExpanded]);

  // Edit first item when clicking on single item, or expand when multiple
  const handleContentClick = useCallback(() => {
    if (isSingleItem) {
      onEdit(group.sources[0].grocery);
    } else {
      setIsExpanded(!isExpanded);
    }
  }, [isSingleItem, group.sources, onEdit, isExpanded]);

  // Format the aggregated display with locale-aware units
  const aggregatedDisplay = formatAmountUnit(group.totalAmount, group.displayUnit);

  // Get recurring info for single item
  const singleSource = isSingleItem ? group.sources[0] : null;
  const singleRecurringGrocery = singleSource?.grocery.recurringGroceryId
    ? (recurringGroceries.find((r) => r.id === singleSource.grocery.recurringGroceryId) ?? null)
    : null;

  return (
    <div className={`bg-content1 ${roundedClass}`}>
      {/* Main row */}
      <div
        className={`flex items-center gap-3 px-4 py-3 ${
          group.sources.length > 1 ? "min-h-[72px]" : "min-h-14"
        }`}
      >
        <div className="flex h-8 w-8 items-center justify-center">{dragHandle}</div>

        {/* Group checkbox - toggles all items */}
        <Checkbox
          isIndeterminate={group.anyDone && !group.allDone}
          isSelected={group.allDone}
          radius="full"
          size="lg"
          onValueChange={handleGroupToggle}
        />

        {/* Clickable content area */}
        <button
          className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
          type="button"
          onClick={handleContentClick}
        >
          {/* Main row: aggregated amount + name */}
          <div className="flex w-full items-baseline gap-1.5">
            {/* Highlighted aggregated amount */}
            {aggregatedDisplay && (
              <span
                className={`shrink-0 font-medium ${
                  group.allDone ? "text-default-400" : "text-primary"
                }`}
              >
                {aggregatedDisplay}
              </span>
            )}
            <span
              className={`truncate text-base ${
                group.allDone ? "text-default-400 line-through" : "text-foreground"
              }`}
            >
              {group.displayName || t("unnamedItem")}
            </span>
          </div>

          {/* Single item: show recipe name or recurrence */}
          {isSingleItem && singleSource?.recipeName && !singleRecurringGrocery && (
            <span className="text-default-400 mt-0.5 truncate text-xs">
              {singleSource.recipeName}
            </span>
          )}

          {/* Single item: show recurring pill */}
          {isSingleItem && singleRecurringGrocery && (
            <RecurrencePill className="mt-0.5" recurringGrocery={singleRecurringGrocery} />
          )}

          {/* Multiple items: show inline recipe breakdown */}
          {!isSingleItem && (
            <span className="text-default-400 mt-0.5 truncate text-xs">
              {formatInlineSourceBreakdown(group.sources, formatAmountUnit)}
            </span>
          )}
        </button>

        {/* Expand/collapse button for groups */}
        {!isSingleItem && (
          <button
            className="text-default-400 hover:text-foreground shrink-0 p-1 transition-colors"
            type="button"
            onClick={handleExpandClick}
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDownIcon className="h-5 w-5" />
            </motion.div>
          </button>
        )}
      </div>

      {/* Expanded source list */}
      <AnimatePresence>
        {isExpanded && !isSingleItem && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-default-100 divide-default-100 ml-10 divide-y border-t">
              {group.sources.map((source) => (
                <SourceItem
                  key={source.grocery.id}
                  recurringGroceries={recurringGroceries}
                  source={source}
                  onEdit={onEdit}
                  onToggle={onToggle}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Individual source item within an expanded group.
 * Shows full original ingredient name + recipe source.
 */
interface SourceItemProps {
  source: GroupedGrocerySource;
  recurringGroceries: RecurringGroceryDto[];
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
}

function SourceItem({ source, recurringGroceries, onToggle, onEdit }: SourceItemProps) {
  const { grocery, recipeName } = source;
  const { formatAmountUnit } = useUnitFormatter();

  const recurringGrocery = grocery.recurringGroceryId
    ? (recurringGroceries.find((r) => r.id === grocery.recurringGroceryId) ?? null)
    : null;

  const amountDisplay = formatAmountUnit(grocery.amount, grocery.unit);
  const hasSubtitle = Boolean(recurringGrocery || recipeName);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${hasSubtitle ? "min-h-[56px]" : "min-h-12"}`}
    >
      <Checkbox
        isSelected={grocery.isDone}
        radius="full"
        size="md"
        onValueChange={(checked) => onToggle(grocery.id, checked)}
      />

      <button
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left"
        type="button"
        onClick={() => onEdit(grocery)}
      >
        {/* Amount (primary) + full ingredient name - matches main item formatting */}
        <div className="flex w-full items-baseline gap-1.5">
          {amountDisplay && (
            <span
              className={`shrink-0 text-sm font-medium ${
                grocery.isDone ? "text-default-400" : "text-primary"
              }`}
            >
              {amountDisplay}
            </span>
          )}
          <span
            className={`truncate text-sm ${
              grocery.isDone ? "text-default-400 line-through" : "text-foreground"
            }`}
          >
            {grocery.name || "Unknown item"}
          </span>
        </div>

        {/* Recipe name as subtitle */}
        {recipeName && (
          <span
            className={`truncate text-xs ${
              grocery.isDone ? "text-default-400" : "text-default-500"
            }`}
          >
            {recipeName}
          </span>
        )}

        {/* Manual indicator if no recipe */}
        {!recipeName && !recurringGrocery && (
          <span
            className={`truncate text-xs ${
              grocery.isDone ? "text-default-400" : "text-default-500"
            }`}
          >
            Manual
          </span>
        )}

        {/* Recurring pill if applicable */}
        {recurringGrocery && (
          <RecurrencePill subtle className="mt-0.5" recurringGrocery={recurringGrocery} />
        )}
      </button>
    </div>
  );
}

export const GroupedGroceryItem = memo(GroupedGroceryItemComponent);
