import React, { useEffect, useState } from "react";
import { Text } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";
import {
  lineOf,
  useAisleChoice,
  useGroceriesQuery,
  useGroceryEdit,
  useGroceryFor,
  useGroceryFormState,
  useGroceryPrice,
  useParsedGroceryName,
  useRecurrenceDetection,
  useRecurringGroceryFor,
  useSettledName,
  useStoresQuery,
} from "@norish/shared-react/groceries";
import { useIngredientFor } from "@norish/shared-react/ingredients";
import { recurrencePatternOf } from "@norish/shared/contracts/recurrence";

import { NameField } from "../components/form-parts";
import { GrocerySheet } from "../components/grocery-sheet";
import { ProductRow } from "../components/product-row";

function EditSheet({
  grocery,
  recurring,
  recipeName,
}: {
  grocery: GroceryDto;
  recurring: RecurringGroceryDto | null;
  recipeName: string | null;
}) {
  const intl = useIntl();
  const router = useRouter();
  const { stores } = useStoresQuery();
  const { save, remove } = useGroceryEdit(grocery, recurring);
  const form = useGroceryFormState(
    [grocery.amount, grocery.unit, grocery.name].filter(Boolean).join(" ")
  );
  const [storeId, setStoreId] = useState<string | null>(grocery.storeId ?? null);
  const [seeded, setSeeded] = useState(false);
  const { detectedPattern } = useRecurrenceDetection({ itemName: form.itemName });
  const groceryName = useParsedGroceryName(form.itemName);
  const ingredientId = useIngredientFor(groceryName, useSettledName(groceryName), grocery);
  const store = stores.find((candidate) => candidate.id === storeId) ?? null;
  const aisle = useAisleChoice({ groceryName, ingredientId, store, resetOn: grocery.id });
  // What the Store charges for this food, at the line as it is saved.
  const price = useGroceryPrice({ ...lineOf(grocery), storeId, ingredientId });
  const trimmed = form.itemName.trim();

  // The sheet starts on the grocery's own repeat.
  if (!seeded) {
    setSeeded(true);
    if (recurring) form.setConfirmedPattern(recurrencePatternOf(recurring));
  }

  const submit = () => {
    if (!trimmed) return;
    // Folded into the one save, so the update and the Store change are one write.
    save(
      trimmed,
      form.confirmedPattern,
      storeId === (grocery.storeId ?? null) ? undefined : storeId,
      grocery.purchaseAmount ?? null
    );
    aisle.commit();
    router.back();
  };

  return (
    <GrocerySheet
      actions={
        <Sheet.Actions>
          <Sheet.Action>
            <Button
              className="h-[50px]"
              testID="edit-grocery-delete"
              variant="secondary"
              onPress={() => {
                remove();
                router.back();
              }}
            >
              <Button.Label className="text-danger font-medium">
                {intl.formatMessage({ id: "common.actions.delete" })}
              </Button.Label>
            </Button>
          </Sheet.Action>
          <Sheet.Action>
            <Button
              className="h-[50px]"
              isDisabled={!trimmed}
              testID="edit-grocery-save"
              variant="primary"
              onPress={submit}
            >
              <Button.Label className="font-semibold">
                {intl.formatMessage({ id: "common.actions.save" })}
              </Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
      }
      aisleId={aisle.aisleId}
      aisles={groceryName === "" ? [] : aisle.aisles}
      confirmed={form.confirmedPattern}
      detected={detectedPattern?.pattern ?? null}
      field={
        <NameField
          placeholderId="groceries.panel.editPlaceholder"
          testID="edit-grocery-field"
          value={form.itemName}
          onChange={form.setItemName}
          onSubmit={submit}
        />
      }
      name="edit-grocery"
      noStoreLabelId="groceries.mobile.noStore"
      notes={
        recipeName ? (
          <Text className="text-muted px-2 text-[13px]">
            {intl.formatMessage({ id: "groceries.mobile.fromRecipe" }, { recipe: recipeName })}
          </Text>
        ) : null
      }
      product={<ProductRow price={price} />}
      storeId={storeId}
      stores={stores}
      title={intl.formatMessage({ id: "groceries.mobile.editTitle" })}
      onAisle={aisle.setAisleId}
      onConfirmDetected={() => form.handleConfirmPattern(detectedPattern)}
      onConfirmed={(pattern) => form.setConfirmedPattern(pattern)}
      onStore={setStoreId}
    />
  );
}

/** Edit grocery: read off the list as it is now, closed once a housemate deletes the line. */
export function EditGroceryScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const grocery = useGroceryFor(id ?? null);
  const recurring = useRecurringGroceryFor(id ?? null);
  const { isLoading, getRecipeNameForGrocery } = useGroceriesQuery();
  const gone = !grocery && !isLoading;

  useEffect(() => {
    if (gone) router.back();
  }, [gone, router]);

  return grocery ? (
    <EditSheet
      key={grocery.id}
      grocery={grocery}
      recipeName={getRecipeNameForGrocery(grocery)}
      recurring={recurring}
    />
  ) : (
    <Sheet name="edit-grocery" title={intl.formatMessage({ id: "groceries.mobile.editTitle" })}>
      <SheetBody>
        <Skeleton className="h-[52px] rounded-[18px]" />
      </SheetBody>
    </Sheet>
  );
}
