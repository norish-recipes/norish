import type { TabScroll } from "@/lib/use-tab-scroll";
import React from "react";
import { View } from "react-native";
import { TabRootHeader } from "@/components/tab-root-header";
import { useConfirm } from "@/hooks/use-confirm";
import { lightImpact } from "@/lib/haptics";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { useUnitsQuery } from "@norish/shared-react/config";
import {
  groupGroceriesByRecipe,
  useAisleLinksLoading,
  useFileGroceryName,
  useGroceriesMutations,
  useGroceriesQuery,
  useStoreAisles,
  useStoresQuery,
  writeDrop,
} from "@norish/shared-react/groceries";
import { useDevicePreference } from "@norish/shared-react/reader";
import { groupGroceriesByIngredient } from "@norish/shared/lib/grocery-grouping";

import type { GroceryListState } from "../hooks/use-grocery-list-state";
import type { GroceryDrop } from "../utils/grocery-drop";
import type { ListActions } from "./groceries-list";
import { planRecipeRowDrop, planStoreRowDrop } from "../utils/grocery-drop";
import { recipeListRows, storeListRows, toggledGroup } from "../utils/list-rows";
import { GroceriesList } from "./groceries-list";
import { GroceriesEmpty, GroceriesSkeleton } from "./groceries-states";
import { listSettingsItem } from "./list-settings-item";
import { ListSwitchSpace } from "./list-switch";

/** Adds or removes `key`: the sets of folded sections and of open done tails. */
function flipped(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);

  if (!next.delete(key)) next.add(key);

  return next;
}

/** The Groceries page's list, by Store or by recipe, ticked in place, edited on a tap; its title
 * and settings fill the bar, the title riding the list's scroll. The page keeps its `state`. */
export function GroceryListSection({
  scroll,
  state,
}: {
  scroll: TabScroll;
  state: GroceryListState;
}) {
  const intl = useIntl();
  const router = useRouter();
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
  const { doneOpen, setDoneOpen, collapsed, setCollapsed, openGroups, setOpenGroups } = state;

  // Until a read holds data an empty list is unknown, not empty: a failed first read stays a skeleton.
  const isListRead = groceries.length > 0 || (isRead && (view === "recipe" || storesRead));
  const loading = isLoading || storesLoading || aislesLoading || !isListRead;
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
  const nothing = groceries.length === 0;

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
    toggle: (ids, isDone) => {
      lightImpact();
      toggleGroceries(ids, isDone);
    },
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
      <TabRootHeader
        items={[
          listSettingsItem(intl, {
            canClear: groceries.length > 0,
            grouped,
            view,
            onClear: () =>
              clear(
                null,
                groceries.map((grocery) => grocery.id)
              ),
            onGrouped: setGrouped,
            onManageStores: () => router.push(TAB_ROUTES.groceries.stores),
            onView: setView,
          }),
        ]}
        offset={scroll.offset}
        title={intl.formatMessage({ id: "groceries.page.title" })}
      />
      <GroceriesList
        actions={actions}
        empty={loading ? <GroceriesSkeleton /> : nothing ? <GroceriesEmpty /> : null}
        header={<ListSwitchSpace />}
        loaded={!loading}
        openGroups={openGroups}
        recipeNameFor={getRecipeNameForGrocery}
        recurringById={new Map(recurringGroceries.map((recurring) => [recurring.id, recurring]))}
        rows={loading ? [] : nothing ? [] : rows}
        storeNameOnLines={view === "recipe"}
        topInset={scroll.barBottom}
        onDrop={drop}
        onScroll={scroll.onScroll}
      />
    </View>
  );
}
