import type { GroceryRecurrenceSettings } from "@/components/shell/sheet/grocery-recurrence-sheet";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { GroceryEditorSheet } from "@/components/shell/sheet/grocery-editor-sheet";
import { DEFAULT_GROCERY_RECURRENCE_SETTINGS } from "@/components/shell/sheet/grocery-recurrence-sheet";
import { useGroceriesContext } from "@/context/groceries-context";
import { useStoresContext } from "@/context/stores-context";
import {
  buildRecipeSections,
  buildStoreSections,
  formatAmountUnit,
} from "@/lib/groceries/grocery-utils";
import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

import type { GroceryDto } from "@norish/shared/contracts";

import type { GroceryViewMode } from "./types";
import { GroceriesMenu } from "./groceries-menu";
import { GrocerySectionCard } from "./grocery-section-card";

/** How long to keep a newly-completed item pinned in place before it slides to the bottom. */
const SORT_DELAY_MS = 380;

function buildGroceryInputText(item: GroceryDto) {
  return [formatAmountUnit(item.amount, item.unit), item.name].filter(Boolean).join(" ");
}

export function GroceriesScreen() {
  const {
    groceries,
    recurringGroceries,
    recipeMap,
    isLoading: groceriesLoading,
    toggleGroceries,
    toggleRecurringGrocery,
    deleteGroceries,
    deleteRecurringGrocery,
    getRecurringGroceryForGrocery,
    createRecurringGrocery,
    updateGrocery,
    updateRecurringGrocery,
    assignGroceryToStore,
  } = useGroceriesContext();
  const [viewMode, setViewMode] = useState<GroceryViewMode>("store");
  const [frozenIds, setFrozenIds] = useState<ReadonlySet<string>>(new Set());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const { stores, isLoading: storesLoading } = useStoresContext();
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"] as const);

  const sections = useMemo(
    () =>
      viewMode === "store"
        ? buildStoreSections({
            groceries,
            stores,
            recipeMap,
            frozenIds,
          })
        : buildRecipeSections({
            groceries,
            stores,
            recipeMap,
            frozenIds,
          }),
    [groceries, stores, recipeMap, viewMode, frozenIds]
  );

  const isLoading = groceriesLoading || storesLoading;

  const handleToggleItem = useCallback(
    (id: string) => {
      const item = groceries.find((i) => i.id === id);
      if (!item) return;

      const newIsDone = !item.isDone;

      // Freeze position so the row stays pinned during the completion animation.
      setFrozenIds((prev) => new Set([...prev, id]));
      setTimeout(() => {
        setFrozenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, SORT_DELAY_MS);

      // Persist to backend via shared mutations (handles optimistic cache + error invalidation).
      if (item.recurringGroceryId) {
        toggleRecurringGrocery(item.recurringGroceryId, id, newIsDone);
      } else {
        toggleGroceries([id], newIsDone);
      }
    },
    [groceries, toggleRecurringGrocery, toggleGroceries]
  );

  const handlePressItem = useCallback((item: GroceryDto) => {
    setEditingItemId(item.id);
  }, []);

  const handleDeleteItem = useCallback(
    (id: string) => {
      // Clean up local transient state.
      setFrozenIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setEditingItemId((current) => (current === id ? null : current));

      // Persist deletion to backend via shared mutations.
      const item = groceries.find((i) => i.id === id);
      if (!item) return;

      if (item.recurringGroceryId) {
        deleteRecurringGrocery(item.recurringGroceryId);
      } else {
        deleteGroceries([id]);
      }
    },
    [groceries, deleteRecurringGrocery, deleteGroceries]
  );

  const editingItem = useMemo(
    () => groceries.find((item) => item.id === editingItemId) ?? null,
    [editingItemId, groceries]
  );
  const editingRecurringGrocery = editingItem
    ? getRecurringGroceryForGrocery(editingItem.id)
    : null;

  const handleSaveEditingItem = useCallback(
    (value: {
      itemText: string;
      storeId: string | null;
      recurrence: GroceryRecurrenceSettings;
    }) => {
      if (!editingItemId || !editingItem) return;

      const { itemText, storeId, recurrence } = value;

      if (editingItem.recurringGroceryId) {
        // Recurring item — route through updateRecurringGrocery.
        // Pass pattern when recurrence stays enabled, null to disable it.
        updateRecurringGrocery(
          editingItem.recurringGroceryId,
          editingItemId,
          itemText,
          recurrence.enabled ? recurrence.pattern : null
        );
      } else if (recurrence.enabled) {
        // Was one-off, user enabled recurrence → delete old one-off, create recurring.
        deleteGroceries([editingItemId]);
        createRecurringGrocery(itemText, recurrence.pattern, storeId);
      } else {
        // One-off item — update text and store separately.
        updateGrocery(editingItemId, itemText);
      }

      // Handle store assignment for non-conversion cases.
      const storeChanged = (editingItem.storeId ?? null) !== storeId;
      if (storeChanged && !(editingItem.recurringGroceryId == null && recurrence.enabled)) {
        assignGroceryToStore(editingItemId, storeId);
      }

      setEditingItemId(null);
    },
    [
      editingItemId,
      editingItem,
      updateRecurringGrocery,
      deleteGroceries,
      createRecurringGrocery,
      updateGrocery,
      assignGroceryToStore,
    ]
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Groceries",
          headerRight: () => <GroceriesMenu viewMode={viewMode} onViewModeChange={setViewMode} />,
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 14 }}
      >
        <View style={{ gap: 14 }}>
          {isLoading ? (
            <GroceriesStateMessage
              title="Loading groceries"
              body="Getting the latest household list."
              foregroundColor={foregroundColor}
              mutedColor={mutedColor}
            />
          ) : sections.length === 0 ? (
            <GroceriesStateMessage
              title="No groceries yet"
              body="Use the add button to start a household grocery list."
              foregroundColor={foregroundColor}
              mutedColor={mutedColor}
            />
          ) : (
            sections.map((section) => (
              <GrocerySectionCard
                key={section.id}
                section={section}
                recurringGroceries={recurringGroceries}
                recipeMap={recipeMap}
                stores={stores}
                contextMode={viewMode}
                frozenIds={frozenIds}
                onToggleItem={handleToggleItem}
                onPressItem={handlePressItem}
                onDeleteItem={handleDeleteItem}
              />
            ))
          )}
        </View>
      </ScrollView>

      <GroceryEditorSheet
        isPresented={!!editingItem}
        mode="edit"
        stores={stores}
        initialValue={
          editingItem
            ? {
                itemText: buildGroceryInputText(editingItem),
                storeId: editingItem.storeId ?? null,
                recurrence: {
                  ...DEFAULT_GROCERY_RECURRENCE_SETTINGS,
                  enabled: !!editingRecurringGrocery,
                },
              }
            : undefined
        }
        onIsPresentedChange={(open) => {
          if (!open) setEditingItemId(null);
        }}
        onSubmit={handleSaveEditingItem}
        onDelete={() => {
          if (editingItemId) handleDeleteItem(editingItemId);
        }}
      />
    </>
  );
}

function GroceriesStateMessage({
  title,
  body,
  foregroundColor,
  mutedColor,
}: {
  title: string;
  body: string;
  foregroundColor: string;
  mutedColor: string;
}) {
  return (
    <View style={{ paddingHorizontal: 18, paddingVertical: 36, gap: 8 }}>
      <Text
        style={{ color: foregroundColor, fontSize: 18, fontWeight: "700", textAlign: "center" }}
      >
        {title}
      </Text>
      <Text style={{ color: mutedColor, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
        {body}
      </Text>
    </View>
  );
}
