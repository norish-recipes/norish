import React, { useEffect, useState } from "react";
import { CardRow } from "@/components/card";
import { destructiveAction } from "@/components/modal-header";
import { Sheet, SheetBody } from "@/components/sheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton } from "heroui-native";
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
  useProductChoice,
  useProductField,
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
import { ProductStep } from "../components/product-step";
import { usePackSizeWords } from "../hooks/use-pack-size-words";

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
  const settledName = useSettledName(groceryName);
  const ingredientId = useIngredientFor(groceryName, settledName, grocery);
  const store = stores.find((candidate) => candidate.id === storeId) ?? null;
  const [productValid, setProductValid] = useState(true);
  const productChoice = useProductChoice({
    groceryName,
    settledName,
    ingredientId,
    stores,
    selectedStoreId: storeId,
    resetOn: grocery.id,
  });
  const packWords = usePackSizeWords();
  const field = useProductField({
    store,
    groceryName,
    linkedProduct: productChoice.linkedProduct,
    linkPending: productChoice.linkPending,
    choice: productChoice.choice,
    onChoice: productChoice.setChoice,
    onValidityChange: setProductValid,
    locale: intl.locale,
    packWords,
  });
  const aisle = useAisleChoice({ groceryName, ingredientId, store, resetOn: grocery.id });
  // What the Store charges for this food, at the line as it is saved.
  const price = useGroceryPrice({ ...lineOf(grocery), storeId, ingredientId });
  const trimmed = form.itemName.trim();
  // A product the list does not price yet: one just chosen, or a Store's link for this food.
  const shown =
    field.picked !== null ||
    field.hasTypedPrice ||
    (productChoice.linkedProduct && !field.unlinked);
  const held =
    shown && (productChoice.choice !== null || price.status !== "priced")
      ? { name: field.manualName, detail: field.detailsSummary }
      : null;

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
    productChoice.commit();
    router.back();
  };

  return (
    <GrocerySheet
      aisleId={aisle.aisleId}
      aisles={groceryName === "" ? [] : aisle.aisles}
      actions={{
        confirm: {
          label: intl.formatMessage({ id: "common.actions.save" }),
          disabled: !trimmed || !productValid,
          onPress: submit,
        },
        secondary: [
          destructiveAction(intl.formatMessage({ id: "common.actions.delete" }), () => {
            remove();
            router.back();
          }),
        ],
      }}
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
      product={(open) => (
        <ProductRow held={held} price={price} onPress={field.pointsAtShop ? open : undefined} />
      )}
      productStep={(back) =>
        store ? (
          <ProductStep
            field={field}
            linked={productChoice.linkedProduct !== null}
            store={store}
            onBack={back}
          />
        ) : null
      }
      repeat={form.confirmedPattern}
      storeId={storeId}
      stores={stores}
      title={intl.formatMessage({ id: "groceries.mobile.editTitle" })}
      trailingRows={
        recipeName ? (
          <CardRow
            label={intl.formatMessage({ id: "calendar.timeline.recipe" })}
            value={recipeName}
          />
        ) : null
      }
      onAisle={aisle.setAisleId}
      onConfirmDetected={() => form.handleConfirmPattern(detectedPattern)}
      onRepeat={(pattern) => form.setConfirmedPattern(pattern)}
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
