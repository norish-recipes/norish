"use client";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@/types";
import type { RecurrencePattern } from "@/types/recurrence";

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

type EditGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grocery: GroceryDto;
  recurringGrocery: RecurringGroceryDto | null;
  stores: StoreDto[];
  onSave: (itemName: string, pattern: RecurrencePattern | null) => void;
  onAssignToStore: (storeId: string | null, savePreference?: boolean) => void;
  onDelete: () => void;
};

export default function EditGroceryPanel({
  open,
  onOpenChange,
  grocery,
  recurringGrocery,
  stores,
  onSave,
  onAssignToStore,
  onDelete,
}: EditGroceryPanelProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [hasStoreChanged, setHasStoreChanged] = useState(false);

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
      setSelectedStoreId(grocery.storeId ?? null);
      setHasStoreChanged(false);

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

  const handleStoreChange = (storeId: string | null) => {
    setSelectedStoreId(storeId);
    setHasStoreChanged(storeId !== (grocery.storeId ?? null));
  };

  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed) return;

    onSave(trimmed, confirmedPattern);

    // If store changed, save that too (with preference)
    if (hasStoreChanged) {
      onAssignToStore(selectedStoreId, true);
    }

    onOpenChange(false);
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
        title={t("editTitle")}
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
                placeholder={t("editPlaceholder")}
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
                label={t("selectStore")}
                selectedStoreId={selectedStoreId}
                showWhenEmpty
                stores={stores}
                onSelectionChange={handleStoreChange}
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
                  className="-mt-1 font-medium"
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
                color="danger"
                size="sm"
                variant="flat"
                onPress={onDelete}
              >
                {tActions("delete")}
              </Button>
              <Button
                className="min-w-16"
                color="primary"
                isDisabled={!itemName.trim()}
                size="sm"
                onPress={handleSubmit}
              >
                {tActions("save")}
              </Button>
            </div>
          </form>
        </div>
      </Panel>

      {/* Recurrence Panel */}
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
