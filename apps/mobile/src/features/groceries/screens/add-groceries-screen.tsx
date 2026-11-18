import type { ComponentRef } from "react";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useRouter } from "expo-router";
import { Input, Switch } from "heroui-native";
import { useIntl } from "react-intl";

import {
  useAisleChoice,
  useGroceriesMutations,
  useGroceryFormState,
  useParsedGroceryName,
  useRecurrenceDetection,
  useSettledName,
  useStoresQuery,
} from "@norish/shared-react/groceries";
import { useIngredientFor } from "@norish/shared-react/ingredients";

import { NameField } from "../components/form-parts";
import { GrocerySheet } from "../components/grocery-sheet";

/** Add groceries: the text, a Store and a repeat, the sheet staying open for the next one. */
export function AddGroceriesScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { stores } = useStoresQuery();
  const { createGrocery, createRecurringGrocery } = useGroceriesMutations();
  const form = useGroceryFormState();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [another, setAnother] = useState(true);
  // One per grocery added, so the sheet that stays open starts the next one afresh.
  const [added, setAdded] = useState(0);
  const fieldRef = useFocusOnMount<ComponentRef<typeof Input>>();
  const { detectedPattern } = useRecurrenceDetection({ itemName: form.itemName });
  const groceryName = useParsedGroceryName(form.itemName);
  const ingredientId = useIngredientFor(groceryName, useSettledName(groceryName));
  const store = stores.find((candidate) => candidate.id === storeId) ?? null;
  const aisle = useAisleChoice({ groceryName, ingredientId, store, resetOn: added });
  const trimmed = form.itemName.trim();

  const submit = () => {
    if (!trimmed) return;
    if (form.confirmedPattern) createRecurringGrocery(trimmed, form.confirmedPattern, storeId);
    else createGrocery(trimmed, storeId);
    // The aisle is filed after the grocery is created, only where it differs from what the Store remembered.
    aisle.commit();
    form.reset();
    setAdded(added + 1);
    if (!another) router.back();
  };

  return (
    <GrocerySheet
      aisleId={aisle.aisleId}
      aisles={groceryName === "" ? [] : aisle.aisles}
      actions={{
        confirm: {
          label: intl.formatMessage({ id: "common.actions.add" }),
          disabled: !trimmed,
          onPress: submit,
        },
      }}
      detected={detectedPattern?.pattern ?? null}
      field={
        <NameField
          fieldRef={fieldRef}
          placeholderId="groceries.panel.editPlaceholder"
          testID="add-grocery-field"
          value={form.itemName}
          onChange={form.setItemName}
          onSubmit={submit}
        />
      }
      name="add-grocery"
      noStoreLabelId="groceries.mobile.automatic"
      repeat={form.confirmedPattern}
      storeId={storeId}
      stores={stores}
      title={intl.formatMessage({ id: "groceries.mobile.addTitle" })}
      trailingRows={
        <View className="border-separator min-h-[52px] flex-row items-center border-t px-4">
          <Text className="text-foreground flex-1 text-base">
            {intl.formatMessage({ id: "groceries.panel.addAnother" })}
          </Text>
          <Switch
            accessibilityLabel={intl.formatMessage({ id: "groceries.panel.addAnother" })}
            isSelected={another}
            testID="add-grocery-another"
            onSelectedChange={setAnother}
          />
        </View>
      }
      onAisle={aisle.setAisleId}
      onConfirmDetected={() => form.handleConfirmPattern(detectedPattern)}
      onRepeat={(pattern) => form.setConfirmedPattern(pattern)}
      onStore={setStoreId}
    />
  );
}
