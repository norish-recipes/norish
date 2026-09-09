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

import type { StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { useGroceryFormState } from "@norish/shared-react/hooks";

type AddGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
  onCreate: (itemName: string, storeId?: string | null, purchaseAmount?: number | null) => void;
  onCreateRecurring: (
    itemName: string,
    pattern: RecurrencePattern,
    storeId?: string | null,
    purchaseAmount?: number | null
  ) => void;
};
export default function AddGroceryPanel({
  open,
  onOpenChange,
  stores,
  onCreate,
  onCreateRecurring,
}: AddGroceryPanelProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const [purchaseAmount, setPurchaseAmount] = useState<number | null>(null);
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  // Whether what is typed in the product field could be saved as it stands.
  const [productValid, setProductValid] = useState(true);
  // One per grocery added, so the panel that stays open for the next one is
  // not still showing the last one's product.
  const [added, setAdded] = useState(0);
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

  // Reset form when panel closes
  useEffect(() => {
    if (!open) {
      reset();
      setPurchaseAmount(null);
      setSelectedStoreId(null);
      setProductValid(true);
    }
  }, [open, reset]);
  const price = useProductChoice({
    itemName,
    stores,
    selectedStoreId,
    resetOn: open,
  });
  // Where the chosen Store files this name; a new name can be taught to the
  // Store the moment it is typed.
  const aisle = useAisleChoice({
    groceryName: price.groceryName,
    store: price.store,
    resetOn: open,
  });
  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed || !productValid) return;
    if (confirmedPattern) {
      onCreateRecurring(trimmed, confirmedPattern, selectedStoreId, purchaseAmount);
    } else {
      onCreate(trimmed, selectedStoreId, purchaseAmount);
    }

    // The picker's choice is written here and nowhere else — and the aisle
    // after the grocery is created, only where it differs from what the Store
    // remembered.
    price.commit();
    aisle.commit();

    // Reset form but keep panel open for batch adding; `commit` has already
    // put the price stage back.
    reset();
    setPurchaseAmount(null);
    setAdded((count) => count + 1);
    // Keep the store selection for batch adding to same store
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
      <Panel open={open} title={t("addTitle")} onOpenChange={handlePanelOpenChange}>
        <Panel.Body>
          <div className="space-y-3">
            <Input
              className="h-12 text-base font-medium"
              placeholder={t("placeholder")}
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
              label={t("storeOptional")}
              noStoreDescription={t("autoDetectFromHistory")}
              placeholder={t("autoDetectOrSelect")}
              selectedStoreId={selectedStoreId}
              stores={stores}
              onSelectionChange={setSelectedStoreId}
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
                // A different Store is a different question, and so is the
                // next grocery: the field starts over rather than carrying the
                // last shop's answers into it.
                key={`${price.store.id}:${added}`}
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
            <ActionButton
              action="add"
              isDisabled={!itemName.trim() || !productValid}
              onPress={handleSubmit}
            >
              {tActions("add")}
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
