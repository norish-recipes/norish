"use client";

import { useEffect, useState } from "react";
import { RecurrenceSuggestion } from "@/app/(app)/groceries/components/recurrence-suggestion";
import { StoreSelector } from "@/components/groceries/store-selector";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import Panel from "@/components/Panel/Panel";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { useRecurrenceDetection } from "@/hooks/use-recurrence-detection";
import { Input } from "@heroui/react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import type { StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { useGroceryFormState } from "@norish/shared-react/hooks";

type AddGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreDto[];
  onCreate: (itemName: string, storeId?: string | null) => void;
  onCreateRecurring: (
    itemName: string,
    pattern: RecurrencePattern,
    storeId?: string | null
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
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
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
      setSelectedStoreId(null);
    }
  }, [open, reset]);
  const handleSubmit = () => {
    const trimmed = itemName.trim();
    if (!trimmed) return;
    if (confirmedPattern) {
      onCreateRecurring(trimmed, confirmedPattern, selectedStoreId);
    } else {
      onCreate(trimmed, selectedStoreId);
    }

    // Reset form but keep panel open for batch adding
    reset();
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
              variant="secondary"
              placeholder={t("placeholder")}
              style={{
                fontSize: "16px",
              }}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
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

            {/* Recurrence Pills Container */}
            <AnimatePresence mode="popLayout">
              <div className="flex flex-wrap items-center gap-2">
                {/* Suggested pill  */}
                {detectedPattern && (
                  <RecurrenceSuggestion
                    key="detected"
                    itemName={itemName}
                    pattern={detectedPattern.pattern}
                    type="detected"
                    onReplace={() => handleConfirmPattern(detectedPattern)}
                  />
                )}

                {/* Active pill */}
                {confirmedPattern && (
                  <RecurrenceSuggestion
                    key="confirmed"
                    itemName={itemName}
                    pattern={confirmedPattern}
                    type="confirmed"
                    onEdit={() => setRecurrencePanelOpen(true)}
                    onRemove={handleRemovePattern}
                  />
                )}
              </div>
            </AnimatePresence>

            {/* Link to manual recurrence editor */}
            {!confirmedPattern && !detectedPattern && (
              <ActionButton
                action="add"
                className="min-w-16 font-medium"
                size="sm"
                onPress={() => setRecurrencePanelOpen(true)}
                variant="tertiary"
              >
                {t("addRepeat")}
              </ActionButton>
            )}
          </div>
        </Panel.Body>
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="add" isDisabled={!itemName.trim()} onPress={handleSubmit}>
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
