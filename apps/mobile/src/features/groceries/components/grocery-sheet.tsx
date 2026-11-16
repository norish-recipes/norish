import type { HeaderConfirm } from "@/components/modal-header";
import type { ReactNode } from "react";
import React, { useState } from "react";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { Button } from "heroui-native";
import { useIntl } from "react-intl";

import type { AisleDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { sortAisles } from "@norish/shared/lib/aisles";

import type { Choice } from "./choice-list";
import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { storeColorIn } from "../hooks/use-store-color";
import { ChoiceList } from "./choice-list";
import { FormCard, FormRow, RepeatPills } from "./form-parts";
import { RepeatBody } from "./repeat-view";

type Step = "form" | "repeat" | "store" | "aisle" | "product";

/** The add and edit sheets' shell. The form is one view; Repeat, Store and Aisle replace it
 * inside the same sheet, the close button going back, so a pick returns to what was typed. */
export function GrocerySheet({
  name,
  title,
  subtitle,
  field,
  notes,
  product,
  productStep,
  stores,
  storeId,
  noStoreLabelId,
  onStore,
  aisles,
  aisleId,
  onAisle,
  detected,
  confirmed,
  onConfirmDetected,
  onConfirmed,
  trailingRows,
  confirm,
  actions,
}: {
  /** The testID prefix: `<name>-sheet`. */
  name: string;
  title: string;
  subtitle?: string;
  field: ReactNode;
  /** What sits under the field, such as where the grocery came from. */
  notes?: ReactNode;
  /** The Store Product the grocery is priced by, the form's first row; `open` shows its search. */
  product?: (open: () => void) => ReactNode;
  /** The product search that replaces the form, given what goes back to it. */
  productStep?: (back: () => void) => ReactNode;
  stores: readonly StoreDto[];
  storeId: string | null;
  noStoreLabelId: string;
  onStore: (storeId: string | null) => void;
  /** The held Store's aisles; empty where there is no Aisle row to show. */
  aisles: readonly AisleDto[];
  aisleId: string | null;
  onAisle: (aisleId: string | null) => void;
  detected: RecurrencePattern | null;
  confirmed: RecurrencePattern | null;
  onConfirmDetected: () => void;
  onConfirmed: (pattern: RecurrencePattern | null) => void;
  trailingRows?: ReactNode;
  /** The form view's header item, Save. */
  confirm: HeaderConfirm;
  /** The form view's pinned actions, if any. */
  actions?: ReactNode;
}) {
  const intl = useIntl();
  const recurrence = useRecurrenceLabel();
  const [view, setView] = useState<Step>("form");
  const [draft, setDraft] = useState<RecurrencePattern | null>(null);
  const text = (id: string) => intl.formatMessage({ id });
  const store = stores.find((candidate) => candidate.id === storeId) ?? null;
  const scheme = useResolvedColorScheme();
  const dot = (color: string) => storeColorIn(scheme, color);
  const aisle = aisles.find((candidate) => candidate.id === aisleId) ?? null;
  const openRepeat = () => {
    setDraft(confirmed);
    setView("repeat");
  };
  const back = () => setView("form");

  const choiceSheet = (step: "store" | "aisle", choices: Choice[], value: string | null) => (
    <Sheet
      name={`${name}-${step}`}
      title={text(step === "store" ? "groceries.mobile.store" : "groceries.panel.aisle")}
      onClose={back}
    >
      <ChoiceList
        choices={choices}
        prefix={step}
        value={value}
        onPick={(id) => {
          if (step === "store") onStore(id);
          else onAisle(id);
          back();
        }}
      />
    </Sheet>
  );
  const steps: Record<Step, ReactNode> = {
    form: (
      <Sheet actions={actions} confirm={confirm} name={name} subtitle={subtitle} title={title}>
        <SheetScrollView contentClassName="gap-3">
          {field}
          <RepeatPills
            confirmed={confirmed}
            detected={confirmed ? null : detected}
            onConfirmDetected={onConfirmDetected}
            onEdit={openRepeat}
            onRemove={() => onConfirmed(null)}
          />
          {notes}
          <FormCard>
            {product?.(() => setView("product"))}
            <FormRow
              dotColor={store ? dot(store.color) : undefined}
              first={!product}
              label={text("groceries.mobile.store")}
              testID={`${name}-store`}
              value={store?.name ?? text(noStoreLabelId)}
              onPress={() => setView("store")}
            />
            {aisles.length > 0 ? (
              <FormRow
                label={text("groceries.panel.aisle")}
                testID={`${name}-aisle`}
                value={aisle?.name ?? text("groceries.panel.noAisle")}
                onPress={() => setView("aisle")}
              />
            ) : null}
            <FormRow
              label={text("common.recurrence.title")}
              testID={`${name}-repeat`}
              value={confirmed ? recurrence(confirmed) : text("groceries.mobile.never")}
              onPress={openRepeat}
            />
            {trailingRows}
          </FormCard>
        </SheetScrollView>
      </Sheet>
    ),
    repeat: (
      <Sheet
        actions={
          confirmed ? (
            <Button
              className="h-12"
              testID="repeat-clear"
              variant="secondary"
              onPress={() => {
                onConfirmed(null);
                back();
              }}
            >
              <Button.Label className="font-medium">{text("common.actions.remove")}</Button.Label>
            </Button>
          ) : undefined
        }
        confirm={{
          label: text("common.actions.done"),
          disabled: !draft,
          onPress: () => {
            onConfirmed(draft);
            back();
          },
        }}
        name={`${name}-repeat`}
        title={text("common.recurrence.title")}
        onClose={back}
      >
        <RepeatBody pattern={draft} onChange={setDraft} />
      </Sheet>
    ),
    product: productStep?.(back),
    store: choiceSheet(
      "store",
      [
        { id: null, label: text(noStoreLabelId) },
        ...[...stores]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((candidate) => ({
            id: candidate.id,
            label: candidate.name,
            color: dot(candidate.color),
          })),
      ],
      storeId
    ),
    aisle: choiceSheet(
      "aisle",
      [
        { id: null, label: text("groceries.panel.noAisle") },
        ...sortAisles(aisles).map((candidate) => ({ id: candidate.id, label: candidate.name })),
      ],
      aisleId
    ),
  };

  return steps[view] ?? steps.form;
}
