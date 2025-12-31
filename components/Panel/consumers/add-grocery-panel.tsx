"use client";

import type { RecurrencePattern } from "@/types/recurrence";
import type { StoreDto } from "@/types";

import { useState, useEffect } from "react";
import { Button, Input } from "@heroui/react";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";

import { RecurrenceSuggestion } from "@/app/(app)/groceries/components/recurrence-suggestion";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import { StoreSelector } from "@/components/groceries/store-selector";
import { useGroceryFormState } from "@/hooks/use-grocery-form-state";
import { useRecurrenceDetection } from "@/hooks/use-recurrence-detection";
import Panel, { PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";

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

  return (
    <>
      <Panel
        height={PANEL_HEIGHT_COMPACT}
        open={open && !recurrencePanelOpen}
        title={t("addTitle")}
        onOpenChange={onOpenChange}
      >
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <div className="space-y-3">
              <Input
                classNames={{
                  input: "text-lg font-medium",
                  inputWrapper: "border-primary-200 dark:border-primary-800",
                }}
                placeholder={t("placeholder")}
                size="lg"
                style={{ fontSize: "16px" }}
                value={itemName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                onValueChange={setItemName}
              />

              {/* Store selection */}
              <StoreSelector
                label={t("storeOptional")}
                noStoreDescription={t("autoDetectFromHistory")}
                placeholder={t("autoDetectOrSelect")}
                selectedStoreId={selectedStoreId}
                size="sm"
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
                <Button
                  className="font-medium"
                  size="sm"
                  variant="light"
                  onPress={() => setRecurrencePanelOpen(true)}
                >
                  {t("addRepeat")}
                </Button>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                className="min-w-16"
                color="primary"
                isDisabled={!itemName.trim()}
                size="sm"
                onPress={handleSubmit}
              >
                {tActions("add")}
              </Button>
            </div>
          </form>
        </div>
      </Panel>

      <RecurrencePanel
        initialPattern={confirmedPattern}
        open={recurrencePanelOpen}
        returnToPreviousPanel={() => setRecurrencePanelOpen(false)}
        onOpenChange={setRecurrencePanelOpen}
        onSave={handleRecurrenceSave}
      />
    </>
  );
}
