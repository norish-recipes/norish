import React, { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfirm } from "@/hooks/use-confirm";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useIngredientsSubscription, useUnitsQuery } from "@norish/shared-react/config";
import {
  groupGroceriesByRecipe,
  useAisleLinksLoading,
  useFileGroceryName,
  useGroceriesMutations,
  useGroceriesQuery,
  useGroceriesSubscription,
  useStoreAisles,
  useStoreAislesSubscription,
  useStorePricesSubscription,
  useStoresQuery,
  useStoresSubscription,
  writeDrop,
} from "@norish/shared-react/groceries";
import { useDevicePreference } from "@norish/shared-react/reader";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

import type { ListActions } from "../components/groceries-list";
import type { GroceryDrop } from "../utils/grocery-drop";
import { GroceriesList } from "../components/groceries-list";
import { GroceriesEmpty, GroceriesSkeleton } from "../components/groceries-states";
import { ListSettingsMenu } from "../components/list-settings-menu";
import { ListSwitch } from "../components/list-switch";
import { planRecipeRowDrop, planStoreRowDrop } from "../utils/grocery-drop";
import { recipeListRows, storeListRows, toggledGroup } from "../utils/list-rows";

/** Adds or removes `key`: the sets of folded sections and of open done tails. */
function flipped(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);

  if (!next.delete(key)) next.add(key);

  return next;
}

/** The Groceries tab: the list by Store or by recipe, ticked in place, edited on a tap. */
export function GroceriesScreen() {
  const intl = useIntl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const { groceries, recurringGroceries, recipeMap, isLoading, isRead, getRecipeNameForGrocery } =
    useGroceriesQuery();
  const { stores, isLoading: storesLoading, isRead: storesRead } = useStoresQuery();
  const { aisleFor } = useStoreAisles();
  const aislesLoading = useAisleLinksLoading();
  const { units } = useUnitsQuery();
  const {
    toggleGroceries,
    deleteGroceries,
    markAllDoneInStore,
    deleteDoneInStore,
    reorderGroceriesInStore,
  } = useGroceriesMutations();
  const fileGroceryName = useFileGroceryName();
  // Device Preferences: the reader's own choice on this device, as on web.
  const [view, setView] = useDevicePreference("groceryViewMode");
  const [grouped, setGrouped] = useDevicePreference("groceryGroupSimilar");
  const [doneOpen, setDoneOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());

  // The list's realtime; the Warm Set keeps its reads for the first frame.
  useGroceriesSubscription();
  useStoresSubscription();
  useStorePricesSubscription();
  useStoreAislesSubscription();
  useIngredientsSubscription();

  // Until a read holds data an empty list is unread, not empty: a failed first read stays a skeleton.
  const unread = groceries.length === 0 && !(isRead && (view === "recipe" || storesRead));
  const loading = isLoading || storesLoading || aislesLoading || unread;
  const groups =
    view === "store" && grouped
      ? groupGroceriesByIngredient(groceries, getRecipeNameForGrocery, units, (grocery) =>
          aisleFor(grocery.storeId, grocery.ingredientId)
        )
      : null;
  const recipes =
    view === "recipe"
      ? groupGroceriesByRecipe(
          groceries,
          recipeMap,
          intl.formatMessage({ id: "groceries.empty.manual" })
        )
      : [];
  const rows =
    view === "store"
      ? storeListRows({ stores, groceries, aisleFor, groups, doneOpen, collapsed })
      : recipeListRows(recipes, stores);
  // Planned against the list as it is when the row lands, and written as web writes a drop.
  const drop = (landed: GroceryDrop) => {
    const plan =
      view === "store"
        ? planStoreRowDrop({ drop: landed, groceries, stores, aisleFor, groups })
        : planRecipeRowDrop(landed, recipes);

    return plan !== null && writeDrop(plan, reorderGroceriesInStore, fileGroceryName);
  };
  const nothing = groceries.length === 0 && (view === "recipe" || stores.length === 0);

  const clear = (name: string | null, ids: string[]) =>
    confirm({
      title: intl.formatMessage(
        {
          id:
            name === null
              ? "groceries.clearConfirm.listTitle"
              : "groceries.clearConfirm.sectionTitle",
        },
        { name }
      ),
      message: intl.formatMessage(
        {
          id:
            name === null
              ? "groceries.clearConfirm.listDescription"
              : "groceries.clearConfirm.sectionDescription",
        },
        { name, count: ids.length }
      ),
      confirmLabelId: "groceries.clearConfirm.confirm",
      onConfirm: () => deleteGroceries(ids),
    });
  const actions: ListActions = {
    toggle: (ids, isDone) => toggleGroceries(ids, isDone),
    edit: (id) => router.push({ pathname: "/groceries/edit", params: { id } }),
    toggleCollapsed: (key) => setCollapsed(flipped(collapsed, key)),
    toggleDone: (key) => setDoneOpen(flipped(doneOpen, key)),
    toggleGroup: (group) => setOpenGroups(toggledGroup(openGroups, group, groceries)),
    markAllDone: markAllDoneInStore,
    deleteDone: deleteDoneInStore,
    clear: (name, ids) =>
      clear(name || intl.formatMessage({ id: "groceries.store.unsorted" }), ids),
  };

  return (
    <View className="bg-background flex-1" testID="groceries-screen">
      <GroceriesList
        actions={actions}
        empty={loading ? <GroceriesSkeleton /> : nothing ? <GroceriesEmpty /> : null}
        header={
          <View
            className="flex-row items-center justify-between px-5 pb-5"
            style={{ paddingTop: insets.top + 6 }}
          >
            <Text
              accessibilityRole="header"
              className="text-foreground text-[34px] leading-[41px] font-semibold tracking-[-0.75px]"
              testID="large-title"
            >
              {intl.formatMessage({ id: "groceries.page.title" })}
            </Text>
            <View className="flex-row items-center gap-2">
              <ListSettingsMenu
                canClear={groceries.length > 0}
                grouped={grouped}
                view={view}
                onClear={() =>
                  clear(
                    null,
                    groceries.map((grocery) => grocery.id)
                  )
                }
                onGrouped={setGrouped}
                onView={setView}
              />
              <ListSwitch
                value="list"
                onChange={(value) => value === "pantry" && router.push("/groceries/pantry")}
              />
            </View>
          </View>
        }
        openGroups={openGroups}
        recipeNameFor={getRecipeNameForGrocery}
        recurringById={new Map(recurringGroceries.map((recurring) => [recurring.id, recurring]))}
        rows={loading ? [] : nothing ? [] : rows}
        storeNameOnLines={view === "recipe"}
        onDrop={drop}
      />
    </View>
  );
}
