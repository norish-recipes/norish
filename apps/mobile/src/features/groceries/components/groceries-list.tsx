import type { ReactElement } from "react";
import React from "react";
import { FlatList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabListBottomInset } from "@/components/tab-list-inset";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import type { ListRow } from "../utils/list-rows";
import { sectionKeyOf } from "../utils/list-rows";
import { AisleHeadingRow } from "./aisle-heading-row";
import { CardSlice } from "./card-slice";
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

/** The list's rows, virtualised: headings, grocery rows and the done tails, each a slice of its section's card. */
export function GroceriesList({
  rows,
  header,
  empty,
  recipeNameFor,
  recurringById,
  storeNameOnLines,
  actions,
}: {
  rows: ListRow[];
  header: ReactElement;
  empty: ReactElement | null;
  recipeNameFor: (grocery: GroceryDto) => string | null;
  recurringById: ReadonlyMap<string, RecurringGroceryDto>;
  /** The list by recipe names each line's Store under it, where a Store's list never does. */
  storeNameOnLines: boolean;
  actions: ListActions;
}) {
  const insets = useSafeAreaInsets();

  const renderRow = ({ item: row, index }: { item: ListRow; index: number }) => {
    const { edge } = row;

    if (row.kind === "heading") {
      const heading = row.value;

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
    }

    const item = row.value;

    if (item.type === "group") {
      const only = item.group.sources.length === 1 ? item.group.sources[0] : undefined;
      const recurringId = only?.grocery.recurringGroceryId;

      return (
        <CardSlice edge={edge}>
          <GroupRow
            group={item.group}
            recurring={recurringId ? (recurringById.get(recurringId) ?? null) : null}
            store={item.store}
            onEdit={actions.edit}
            onToggle={actions.toggle}
          />
        </CardSlice>
      );
    }

    const { grocery, store } = item;

    return (
      <CardSlice edge={edge}>
        <GroceryRow
          grocery={grocery}
          recipeName={storeNameOnLines ? null : recipeNameFor(grocery)}
          recurring={
            grocery.recurringGroceryId
              ? (recurringById.get(grocery.recurringGroceryId) ?? null)
              : null
          }
          store={store}
          subline={storeNameOnLines ? (store?.name ?? null) : undefined}
          onEdit={actions.edit}
          onToggle={(id, isDone) => actions.toggle([id], isDone)}
        />
      </CardSlice>
    );
  };

  return (
    <View className="flex-1">
      <FlatList
        ListEmptyComponent={empty ?? undefined}
        ListHeaderComponent={header}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: tabListBottomInset(insets.bottom) }}
        contentInsetAdjustmentBehavior="never"
        data={rows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        testID="groceries-list"
      />
      {/* Rows dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
        pointerEvents="none"
      />
    </View>
  );
}
