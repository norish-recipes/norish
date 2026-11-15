import type { Drop } from "@/components/drag-list/drag-list";
import type { ReactElement } from "react";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DragList } from "@/components/drag-list/drag-list";
import { tabListBottomInset } from "@/components/tab-list-inset";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";

import type { ListHeading, ListItem, ListRow } from "../utils/list-rows";
import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { sectionKeyOf } from "../utils/list-rows";
import { AisleHeadingRow } from "./aisle-heading-row";
import { CardSlice, ItemSlice } from "./card-slice";
import { DoneRow } from "./done-row";
import { GroceryRow } from "./grocery-row";
import { GroupRow } from "./group-row";
import { RecipeHeadingRow } from "./recipe-heading-row";
import { StoreHeadingRow } from "./store-heading-row";

export type ListActions = {
  toggle: (ids: string[], isDone: boolean) => void;
  edit: (id: string) => void;
  toggleCollapsed: (sectionKey: string) => void;
  toggleDone: (sectionKey: string) => void;
  markAllDone: (storeId: string | null) => void;
  deleteDone: (storeId: string | null) => void;
  /** Asks, then clears: a Store's, Unsorted's or a recipe's lines. */
  clear: (name: string, ids: string[]) => void;
};

/**
 * The list's rows, virtualised: headings, grocery rows and the done tails, each a slice of its
 * section's card. Holding an open row lifts it; a done one stays put.
 */
export function GroceriesList({
  rows,
  header,
  empty,
  recipeNameFor,
  recurringById,
  storeNameOnLines,
  actions,
  onDrop,
}: {
  rows: ListRow[];
  header: ReactElement;
  empty: ReactElement | null;
  recipeNameFor: (grocery: GroceryDto) => string | null;
  recurringById: ReadonlyMap<string, RecurringGroceryDto>;
  /** The list by recipe names each line's Store under it, where a Store's list never does. */
  storeNameOnLines: boolean;
  actions: ListActions;
  /** A held row let go; false puts it back. */
  onDrop: (drop: Drop<ListHeading, ListItem>) => boolean;
}) {
  const insets = useSafeAreaInsets();
  const recurrence = useRecurrenceLabel();
  // What sits under a row's name: how it repeats, else the recipe it came from.
  const sublineOf = (
    recurring: RecurringGroceryDto | null | undefined,
    recipeName: string | null
  ) => (recurring ? recurrence(recurrencePatternOf(recurring)) : recipeName);

  const renderHeading = (heading: ListHeading, index: number) => {
    const { edge } = heading;

    if (heading.type === "aisle") {
      return (
        <CardSlice edge={edge}>
          <AisleHeadingRow count={heading.count} name={heading.aisle.name} />
        </CardSlice>
      );
    }

    if (heading.type === "done") {
      return (
        <CardSlice edge={edge}>
          <DoneRow
            count={heading.count}
            open={heading.open}
            sectionKey={heading.sectionKey}
            onToggle={() => actions.toggleDone(heading.sectionKey)}
          />
        </CardSlice>
      );
    }

    const gap = index > 0;

    if (heading.type === "recipe") {
      return (
        <CardSlice className="bg-default" edge={edge} gap={gap} separated={false}>
          <RecipeHeadingRow
            heading={heading}
            onClear={() => actions.clear(heading.name, heading.ids)}
          />
        </CardSlice>
      );
    }

    const storeId = heading.store?.id ?? null;
    const key = sectionKeyOf(storeId);

    return (
      <CardSlice className="bg-default" edge={edge} gap={gap} separated={false}>
        <StoreHeadingRow
          actions={
            heading.ids.length > 0
              ? {
                  markAllDone: () => actions.markAllDone(storeId),
                  deleteDone: () => actions.deleteDone(storeId),
                  clearAll: () => actions.clear(heading.store?.name ?? "", heading.ids),
                }
              : undefined
          }
          heading={heading}
          onToggleCollapsed={() => actions.toggleCollapsed(key)}
        />
      </CardSlice>
    );
  };

  const renderItem = (item: ListItem, drag: () => void) => {
    const { edge } = item;

    if (item.type === "group") {
      const only = item.group.sources.length === 1 ? item.group.sources[0] : undefined;
      const recurringId = only?.grocery.recurringGroceryId;

      return (
        <ItemSlice edge={edge}>
          <GroupRow
            group={item.group}
            store={item.store}
            subline={sublineOf(
              recurringId ? recurringById.get(recurringId) : null,
              only?.recipeName ?? null
            )}
            onDrag={item.group.allDone ? undefined : drag}
            onEdit={actions.edit}
            onToggle={actions.toggle}
          />
        </ItemSlice>
      );
    }

    const { grocery, store } = item;

    return (
      <ItemSlice edge={edge}>
        <GroceryRow
          grocery={grocery}
          store={store}
          subline={
            storeNameOnLines
              ? (store?.name ?? null)
              : sublineOf(
                  grocery.recurringGroceryId ? recurringById.get(grocery.recurringGroceryId) : null,
                  recipeNameFor(grocery)
                )
          }
          onDrag={grocery.isDone ? undefined : drag}
          onEdit={actions.edit}
          onToggle={(id, isDone) => actions.toggle([id], isDone)}
        />
      </ItemSlice>
    );
  };

  return (
    <View className="flex-1">
      <DragList
        ListEmptyComponent={empty ?? undefined}
        ListHeaderComponent={header}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: tabListBottomInset(insets.bottom) }}
        contentInsetAdjustmentBehavior="never"
        renderHeading={renderHeading}
        renderItem={renderItem}
        rows={rows}
        testID="groceries-list"
        onDrop={onDrop}
      />
      {/* Rows dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
        pointerEvents="none"
      />
    </View>
  );
}
