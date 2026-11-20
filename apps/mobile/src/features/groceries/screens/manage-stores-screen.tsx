import type { Drop } from "@/components/drag-list/drag-list";
import type { Edge } from "@/lib/card-edges";
import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { DragList } from "@/components/drag-list/drag-list";
import { EmptyCard } from "@/components/empty-card";
import { Sheet, SHEET_SCROLL_END, SheetBody } from "@/components/sheet";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { edgeAt } from "@/lib/card-edges";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { EditingStore } from "@norish/shared-react/groceries";
import type { StoreDto } from "@norish/shared/contracts";
import {
  editingStoreOf,
  newEditingStore,
  SHOP_CHECK_MESSAGES,
  useGroceriesQuery,
  useSaveStore,
  useStoresMutations,
  useStoresQuery,
} from "@norish/shared-react/groceries";

import { SkeletonCard } from "../components/groceries-states";
import { StoreEditorSheet } from "../components/store-editor-sheet";
import { StoreListRow } from "../components/store-list-row";
import { movedAfter } from "../utils/store-order";

type Item = { store: StoreDto; edge: Edge };

/** What the shop answered when a Store's link was last tried, said once the editor has closed. */
function ShopCheckLine({
  storeName,
  result,
}: {
  storeName: string;
  result: { outcome: keyof typeof SHOP_CHECK_MESSAGES; count?: number | null } | null;
}) {
  const intl = useIntl();
  const [accent] = useThemeColor(["accent"] as const);
  const message = result
    ? intl.formatMessage(
        { id: `groceries.storeManager.${SHOP_CHECK_MESSAGES[result.outcome]}` },
        { store: storeName, count: result.count ?? 0 }
      )
    : intl.formatMessage({ id: "groceries.storeManager.checkingShop" }, { store: storeName });

  return (
    <View className="flex-row items-start gap-1.5 px-6 pt-3" testID="shop-check">
      {result?.outcome === "products" ? (
        <Ionicons color={accent} name="checkmark" size={15} />
      ) : null}
      <Text className="text-muted flex-1 text-sm">{message}</Text>
    </View>
  );
}

/** Manage stores: the household's Stores, reordered by holding a row, opened on a tap into the
 * editor that replaces the list inside the same sheet. Deleting asks first, as web does. */
export function ManageStoresScreen() {
  const intl = useIntl();
  const cancel = useCancelButton();
  const text = (id: string) => intl.formatMessage({ id });
  const { stores, isRead } = useStoresQuery();
  const { groceries } = useGroceriesQuery();
  const { deleteStore, reorderStores } = useStoresMutations();
  const { save, shopCheck } = useSaveStore(stores);
  const [editing, setEditing] = useState<EditingStore | null>(null);
  const sorted = [...stores].sort((a, b) => a.sortOrder - b.sortOrder);
  const rows = sorted.map((store, index) => ({
    kind: "item" as const,
    key: store.id,
    value: { store, edge: edgeAt(index, sorted.length) },
  }));

  // Resolved by id against the Stores as they are when the row lands.
  const drop = ({ item, rows: landed }: Drop<never, Item>) => {
    const id = item.store.id;
    const at = landed.findIndex((row) => row.key === id);
    const above = at > 0 ? landed[at - 1].key : null;

    reorderStores(
      movedAfter(
        sorted.map((store) => store.id),
        id,
        above
      )
    );

    return true;
  };
  const confirmDelete = (store: StoreDto) => {
    const count = groceries.filter((grocery) => grocery.storeId === store.id).length;
    const title = intl.formatMessage(
      { id: "groceries.mobile.deleteStoreTitle" },
      { store: store.name }
    );
    const del = { style: "destructive", text: text("groceries.storeManager.deleteItems") } as const;

    Alert.alert(
      title,
      count === 0
        ? text("groceries.storeManager.noItems")
        : `${intl.formatMessage(
            {
              id:
                count === 1
                  ? "groceries.storeManager.hasItems"
                  : "groceries.storeManager.hasItemsPlural",
            },
            { count }
          )} ${text("groceries.storeManager.whatToDo")}`,
      count === 0
        ? [
            cancel,
            {
              ...del,
              text: text("common.actions.delete"),
              onPress: () => deleteStore(store.id, false),
            },
          ]
        : [
            cancel,
            {
              text: text("groceries.mobile.moveItemsToUnsorted"),
              onPress: () => deleteStore(store.id, false),
            },
            { ...del, onPress: () => deleteStore(store.id, true) },
          ]
    );
  };

  if (editing) {
    return (
      <StoreEditorSheet
        editing={editing}
        onBack={() => setEditing(null)}
        onChange={setEditing}
        onSave={async () => {
          // A refused create leaves the editor open on its draft, so Save can try again.
          if (await save(editing)) setEditing(null);
        }}
      />
    );
  }

  return (
    <Sheet
      confirm={{
        label: text("groceries.mobile.addStore"),
        symbol: "plus",
        onPress: () => setEditing(newEditingStore()),
      }}
      name="manage-stores"
      title={text("groceries.mobile.manageStores")}
    >
      {!isRead ? (
        <SheetBody>
          <SkeletonCard className="bg-sand" rowClassName="h-14 gap-3 px-4" rows={3}>
            <View className="bg-sand size-3.5 rounded-full" />
          </SkeletonCard>
        </SheetBody>
      ) : stores.length === 0 ? (
        <SheetBody>
          <EmptyCard
            className="bg-sand"
            icon="storefront-outline"
            testID="stores-empty"
            title={text("groceries.storeManager.noStoresYet")}
            tone="shop"
          />
        </SheetBody>
      ) : (
        <DragList
          ListFooterComponent={
            shopCheck ? (
              <ShopCheckLine result={shopCheck.result} storeName={shopCheck.storeName} />
            ) : undefined
          }
          className="flex-1"
          contentContainerStyle={SHEET_SCROLL_END}
          contentInsetAdjustmentBehavior="never"
          renderHeading={() => null}
          renderItem={({ store, edge }) => (
            <StoreListRow
              count={
                groceries.filter((grocery) => grocery.storeId === store.id && !grocery.isDone)
                  .length
              }
              edge={edge}
              store={store}
              onDelete={() => confirmDelete(store)}
              onEdit={() => setEditing(editingStoreOf(store))}
            />
          )}
          rows={rows}
          testID="stores-list"
          onDrop={drop}
        />
      )}
    </Sheet>
  );
}
