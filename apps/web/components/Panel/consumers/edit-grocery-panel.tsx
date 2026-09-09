"use client";

import { useEffect, useState } from "react";
import { AisleSelector } from "@/components/groceries/aisle-selector";
import { GroceryProductField } from "@/components/groceries/grocery-product-field";
import { GroceryRecurrenceControl } from "@/components/groceries/grocery-recurrence-control";
import { StoreSelector } from "@/components/groceries/store-selector";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useAisleChoice, useProductChoice } from "@/hooks/stores";
import { useRecurrenceDetection } from "@/hooks/use-recurrence-detection";
import { Input } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { useGroceryFormState } from "@norish/shared-react/hooks";

type EditGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grocery: GroceryDto;
  recurringGrocery: RecurringGroceryDto | null;
  stores: StoreDto[];
  onSave: (
    itemName: string,
    pattern: RecurrencePattern | null,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => void;
  onDelete: () => void;
};
export default function EditGroceryPanel({
  open,
  onOpenChange,
  grocery,
  recurringGrocery,
  stores,
  onSave,
  onDelete,
}: EditGroceryPanelProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const [purchaseAmount, setPurchaseAmount] = useState<number | null>(null);
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [hasStoreChanged, setHasStoreChanged] = useState(false);
  // Whether what is typed in the product field could be saved as it stands.
  const [productValid, setProductValid] = useState(true);
  const {
    itemName,
    setItemName,
    confirmedPattern,
    setConfirmedPattern,
    handleConfirmPattern,
    handleRemovePattern,
    reset,
  } = useGroceryFormState();
  const { detectedPattern } = useRecurrenceDetection({
    itemName,
    enabled: open && !recurrencePanelOpen,
  });

  // Initialize form with grocery data when opening
  useEffect(() => {
    if (open) {
      const text = [grocery.amount, grocery.unit, grocery.name].filter(Boolean).join(" ");

      setItemName(text);
      setPurchaseAmount(grocery.purchaseAmount ?? null);
      setSelectedStoreId(grocery.storeId ?? null);
      setHasStoreChanged(false);
      setProductValid(true);
      if (recurringGrocery) {
        setConfirmedPattern({
          rule: recurringGrocery.recurrenceRule as "day" | "week" | "month",
          interval: recurringGrocery.recurrenceInterval,
          weekday: recurringGrocery.recurrenceWeekday ?? undefined,
        });
      } else {
        setConfirmedPattern(null);
      }
    } else {
      reset();
    }
  }, [open, grocery, recurringGrocery, setItemName, setConfirmedPattern, reset]);
  const price = useProductChoice({
    itemName,
    stores,
    selectedStoreId,
    resetOn: grocery.id,
  });
  // Where the chosen Store files this name, re-read when the Store is swapped.
  const aisle = useAisleChoice({
    groceryName: price.groceryName,
    store: price.store,
    resetOn: grocery.id,
  });
  const handleStoreChange = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setHasStoreChanged(storeId !== (grocery.storeId ?? null));
  };
  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed || !productValid) return;

    // Fold the store change into the single save call so both the name/unit
    // update and the store assignment happen in one atomic mutation (avoiding
    // a version-conflict race between two separate mutations).
    onSave(
      trimmed,
      confirmedPattern,
      hasStoreChanged ? selectedStoreId : undefined,
      purchaseAmount
    );

    // The picker's choice is written here and nowhere else — and the aisle
    // after the grocery is updated, only where it differs from what the Store
    // remembered.
    price.commit();
    aisle.commit();

    onOpenChange(false);
  };
  const handleRecurrenceSave = (pattern: RecurrencePattern | null) => {
    setConfirmedPattern(pattern);
    setRecurrencePanelOpen(false);
  };
  const handlePanelOpenChange = (isOpen: boolean) => {
    if (!isOpen) setRecurrencePanelOpen(false);
    onOpenChange(isOpen);
  };

  return (
    <>
      <Panel open={open} title={t("editTitle")} onOpenChange={handlePanelOpenChange}>
        <Panel.Body>
          <div className="space-y-3">
            <Input
              className="h-12 text-base font-medium"
              placeholder={t("editPlaceholder")}
              style={{
                fontSize: "16px",
              }}
              value={itemName}
              variant="secondary"
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            {/* How often it comes back, right under what it is */}
            <GroceryRecurrenceControl
              confirmedPattern={confirmedPattern}
              detectedPattern={detectedPattern}
              itemName={itemName}
              onConfirmDetected={handleConfirmPattern}
              onEdit={() => setRecurrencePanelOpen(true)}
              onRemove={handleRemovePattern}
            />

            {/* Store selection */}
            <StoreSelector
              showWhenEmpty
              label={t("selectStore")}
              selectedStoreId={selectedStoreId}
              stores={stores}
              onSelectionChange={handleStoreChange}
            />

            {/* Where in that shop this is found: only for a Store with aisles, once there is a name */}
            {price.store && aisle.aisles.length > 0 && price.groceryName !== "" && (
              <AisleSelector
                aisles={aisle.aisles}
                selectedAisleId={aisle.aisleId}
                onSelectionChange={aisle.setAisleId}
              />
            )}

            {/* Which of that shop's products this is */}
            {price.store && (
              <GroceryProductField
                // A different Store is a different question: the field starts
                // over rather than carrying the last shop's answers into it.
                key={price.store.id}
                choice={price.choice}
                groceryName={price.groceryName}
                itemName={itemName}
                linkPending={price.linkPending}
                linkedProduct={price.linkedProduct}
                purchaseAmount={purchaseAmount}
                store={price.store}
                onChoice={price.setChoice}
                onPurchaseAmount={setPurchaseAmount}
                onValidityChange={setProductValid}
              />
            )}
          </div>
        </Panel.Body>
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="delete" onPress={onDelete}>
              {tActions("delete")}
            </ActionButton>
            <ActionButton
              action="save"
              isDisabled={!itemName.trim() || !productValid}
              onPress={handleSubmit}
            >
              {tActions("save")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>

        <RecurrencePanel
          nested
          initialPattern={confirmedPattern}
          open={open && recurrencePanelOpen}
          returnToPreviousPanel={() => setRecurrencePanelOpen(false)}
          onOpenChange={setRecurrencePanelOpen}
          onSave={handleRecurrenceSave}
        />
      </Panel>
    </>
  );
}
