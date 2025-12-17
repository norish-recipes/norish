"use client";

import type { RecurrencePattern } from "@/types/recurrence";

import { useState, useEffect } from "react";
import { Button, Input } from "@heroui/react";
import { AnimatePresence } from "motion/react";

import { RecurrenceSuggestion } from "@/app/(app)/groceries/components/recurrence-suggestion";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import { useGroceryFormState } from "@/hooks/use-grocery-form-state";
import { useRecurrenceDetection } from "@/hooks/use-recurrence-detection";
import Panel, { PANEL_HEIGHT_COMPACT } from "@/components/Panel/Panel";

type AddGroceryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (itemName: string) => void;
  onCreateRecurring: (itemName: string, pattern: RecurrencePattern) => void;
};

export default function AddGroceryPanel({
  open,
  onOpenChange,
  onCreate,
  onCreateRecurring,
}: AddGroceryPanelProps) {
  const [recurrencePanelOpen, setRecurrencePanelOpen] = useState(false);

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
    }
  }, [open, reset]);

  const handleSubmit = () => {
    const trimmed = itemName.trim();

    if (!trimmed) return;

    if (confirmedPattern) {
      onCreateRecurring(trimmed, confirmedPattern);
    } else {
      onCreate(trimmed);
    }

    // Reset form but keep panel open for batch adding
    reset();
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
        title="Add Grocery"
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
                placeholder="e.g., milk every week"
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
                  + Add repeat
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
                Add
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
