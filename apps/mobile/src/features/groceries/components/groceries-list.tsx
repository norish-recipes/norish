import type { Drop } from "@/components/drag-list/drag-list";
import type { Measurable } from "@/hooks/use-focused-field-in-view";
import type { TabScroll } from "@/lib/use-tab-scroll";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CardSlice, ItemSlice } from "@/components/card-slice";
import { DragList, useIsLifted } from "@/components/drag-list/drag-list";
import { TabListMarker } from "@/components/tab-list-marker";
import { useFreshRows } from "@/hooks/use-fresh-rows";
import { SPRING_FADE_IN, SPRING_FADE_OUT, SPRING_LAYOUT } from "@/lib/motion/layout";
import { tabListBottomInset } from "@/lib/tab-bar-placement";
import { homeIndicator } from "@/lib/use-tab-bar-minimised";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";

import type { ListHeading, ListItem, ListRow } from "../utils/list-rows";
import { useLeaveToDone } from "../hooks/use-leave-to-done";
import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { isGroupOpen, sectionKeyOf } from "../utils/list-rows";
import { AisleHeadingRow } from "./aisle-heading-row";
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
  toggleGroup: (group: GroceryGroup) => void;
  markAllDone: (storeId: string | null) => void;
  deleteDone: (storeId: string | null) => void;
  /** Asks, then clears: a Store's, Unsorted's or a recipe's lines. */
  clear: (name: string, ids: string[]) => void;
};

/** A list row as it enters and leaves; the lifted card is a copy, which neither animates nor
 * stands in for the row where a ticked row heads. */
function ListedRow({
  viewRef,
  entering,
  exiting,
  children,
}: {
  viewRef: (view: Measurable | null) => void;
  entering: ComponentProps<typeof Animated.View>["entering"];
  exiting: ComponentProps<typeof Animated.View>["exiting"];
  children: ReactNode;
}) {
  const lifted = useIsLifted();

  if (lifted) return children;

  return (
    <Animated.View ref={viewRef} collapsable={false} entering={entering} exiting={exiting}>
      {children}
    </Animated.View>
  );
}

/** The list's rows, virtualised: headings, grocery rows and the done tails, each a slice of its
 * section's card. Holding an open row lifts it; a done one stays put. */
export function GroceriesList({
  rows,
  loaded,
  header,
  empty,
  recipeNameFor,
  recurringById,
  openGroups,
  storeNameOnLines,
  actions,
  onDrop,
  onScroll,
  topInset,
}: {
  rows: ListRow[];
  /** False while the list waits on its first read, so its first rows don't animate in. */
  loaded: boolean;
  header: ReactElement;
  empty: ReactElement | null;
  recipeNameFor: (grocery: GroceryDto) => string | null;
  recurringById: ReadonlyMap<string, RecurringGroceryDto>;
  /** The lines of the groups folded out, held above the list so the lifted card shows them too. */
  openGroups: ReadonlySet<string>;
  /** The list by recipe names each line's Store under it, where a Store's list never does. */
  storeNameOnLines: boolean;
  actions: ListActions;
  /** A held row let go; false puts it back. */
  onDrop: (drop: Drop<ListHeading, ListItem>) => boolean;
  /** The tab's scroll handler (`useTabScroll`), a worklet the drag list composes. */
  onScroll?: TabScroll["onScroll"];
  /** The bar over the list's top, which auto-scroll stops under. */
  topInset: number;
}) {
  const recurrence = useRecurrenceLabel();
  const { fresh } = useFreshRows(rows, loaded);
  const { exitingFor, leaveThen, doneRef, itemRef } = useLeaveToDone(rows);
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
            viewRef={doneRef(heading.sectionKey)}
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

  const renderItem = (item: ListItem) => {
    const { edge } = item;

    if (item.type === "group") {
      const only = item.group.sources.length === 1 ? item.group.sources[0] : undefined;
      const recurringId = only?.grocery.recurringGroceryId;

      return (
        <ItemSlice edge={edge}>
          <GroupRow
            group={item.group}
            open={isGroupOpen(openGroups, item.group)}
            store={item.store}
            subline={sublineOf(
              recurringId ? recurringById.get(recurringId) : null,
              only?.recipeName ?? null
            )}
            onEdit={actions.edit}
            onToggle={(ids, isDone) => leaveThen(item, isDone, () => actions.toggle(ids, isDone))}
            onToggleOpen={() => actions.toggleGroup(item.group)}
          />
        </ItemSlice>
      );
    }

    const { grocery, store } = item;

    return (
      <ItemSlice edge={edge}>
        <GroceryRow
          dotted={storeNameOnLines}
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
          onEdit={actions.edit}
          onToggle={(id, isDone) => leaveThen(item, isDone, () => actions.toggle([id], isDone))}
        />
      </ItemSlice>
    );
  };

  return (
    <View className="flex-1">
      <TabListMarker>
        <DragList
          ListEmptyComponent={empty ?? undefined}
          ListHeaderComponent={header}
          // A done row stays put, and the done fold takes no drop.
          canLift={(item) => !item.done}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: tabListBottomInset(homeIndicator) }}
          contentInsetAdjustmentBehavior="automatic"
          edgeInsets={{ top: topInset, bottom: tabListBottomInset(homeIndicator) }}
          itemLayoutAnimation={SPRING_LAYOUT}
          renderHeading={(heading, index) => (
            <Animated.View
              entering={fresh.has(heading) ? SPRING_FADE_IN : undefined}
              exiting={SPRING_FADE_OUT}
            >
              {renderHeading(heading, index)}
            </Animated.View>
          )}
          renderItem={(item) => (
            <ListedRow
              entering={fresh.has(item) ? SPRING_FADE_IN : undefined}
              exiting={exitingFor(item.key)}
              viewRef={itemRef(item.key)}
            >
              {renderItem(item)}
            </ListedRow>
          )}
          rows={rows}
          sectionOf={(heading, key) => (heading.type === "done" ? null : key)}
          testID="groceries-list"
          onDrop={onDrop}
          onScroll={onScroll}
        />
      </TabListMarker>
      {/* Rows dissolve into the page colour before the tab bar. */}
      <View
        className="to-background from-background/0 absolute inset-x-0 bottom-0 h-[190px] bg-linear-to-b to-75%"
        pointerEvents="none"
      />
    </View>
  );
}
