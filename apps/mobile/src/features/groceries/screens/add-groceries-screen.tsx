import type { ComponentRef } from "react";
import React, { useState } from "react";
import { CardRow } from "@/components/card";
import { Switch } from "@/components/switch";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useRouter } from "expo-router";
import { Input } from "heroui-native";
import { useIntl } from "react-intl";

import {
  GROCERY_LOOKUP_DEBOUNCE_MS,
  useAisleChoice,
  useGroceriesMutations,
  useGroceryFormState,
  useParsedGroceryName,
  useRecurrenceDetection,
  useStoresQuery,
} from "@norish/shared-react/groceries";
import { useIngredientFor } from "@norish/shared-react/ingredients";
import { useSettledText } from "@norish/shared-react/settled-text";

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
  const ingredientId = useIngredientFor(
    groceryName,
    useSettledText(groceryName, GROCERY_LOOKUP_DEBOUNCE_MS)
  );
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
    // Add another keeps the keyboard up for the next one, the Add button's tap included.
    if (another) fieldRef.current?.focus();
    else router.back();
  };

  return (
    <GrocerySheet
      actions={{
        confirm: {
          label: intl.formatMessage({ id: "common.actions.add" }),
          disabled: !trimmed,
          onPress: submit,
        },
      }}
      aisleId={aisle.aisleId}
      aisles={groceryName === "" ? [] : aisle.aisles}
      detected={detectedPattern?.pattern ?? null}
      field={
        <NameField
          fieldRef={fieldRef}
          keepsFocus={another}
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
        <CardRow label={intl.formatMessage({ id: "groceries.panel.addAnother" })}>
          <Switch
            accessibilityLabel={intl.formatMessage({ id: "groceries.panel.addAnother" })}
            isSelected={another}
            testID="add-grocery-another"
            onSelectedChange={setAnother}
          />
        </CardRow>
      }
      onAisle={aisle.setAisleId}
      onConfirmDetected={() => form.handleConfirmPattern(detectedPattern)}
      onRepeat={(pattern) => form.setConfirmedPattern(pattern)}
      onStore={setStoreId}
    />
  );
}
