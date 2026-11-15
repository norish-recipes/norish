import type { ReactNode } from "react";
import React, { useState } from "react";
import { View } from "react-native";
import { Sheet, SheetScrollView } from "@/components/sheet";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { AisleDto, StoreDto } from "@norish/shared/contracts";
import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";
import { sortAisles } from "@norish/shared/lib/aisles";
import { storeHue } from "@norish/shared/lib/store-colors";

import { useRecurrenceLabel } from "../hooks/use-recurrence-label";
import { FormCard, FormRow, RepeatPills } from "./form-parts";
import { RepeatBody } from "./repeat-view";

type Step = "form" | "repeat" | "store" | "aisle";

type Choice = { id: string | null; label: string; color?: string };

/** One choice of a list: its mark, its label and a check where it is the one held. */
function ChoiceRow({
  choice,
  selected,
  first,
  testID,
  onPick,
}: {
  choice: Choice;
  selected: boolean;
  first: boolean;
  testID: string;
  onPick: () => void;
}) {
  const [accent] = useThemeColor(["accent"] as const);

  return (
    <View className={first ? "" : "border-separator border-t"}>
      <Button
        className="h-[52px] justify-start gap-3 rounded-none px-4"
        testID={testID}
        variant="ghost"
        onPress={onPick}
      >
        {choice.color ? (
          <View className="size-2.5 rounded-full" style={{ backgroundColor: choice.color }} />
        ) : null}
        <Button.Label className="text-foreground flex-1 text-base font-normal">
          {choice.label}
        </Button.Label>
        {selected ? <Ionicons color={accent} name="checkmark" size={18} /> : null}
      </Button>
    </View>
  );
}

function ChoiceList({
  choices,
  value,
  prefix,
  onPick,
}: {
  choices: Choice[];
  value: string | null;
  prefix: string;
  onPick: (id: string | null) => void;
}) {
  return (
    <SheetScrollView>
      <FormCard>
        {choices.map((choice, index) => (
          <ChoiceRow
            key={choice.id ?? "none"}
            choice={choice}
            first={index === 0}
            selected={choice.id === value}
            testID={`${prefix}-${choice.id ?? "none"}`}
            onPick={() => onPick(choice.id)}
          />
        ))}
      </FormCard>
    </SheetScrollView>
  );
}

/**
 * The add and edit sheets' shell. The form is one view; Repeat, Store and Aisle replace it inside
 * the same sheet, the close button going back, so a pick returns to what was typed.
 */
export function GrocerySheet({
  name,
  title,
  subtitle,
  field,
  notes,
  product,
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
  actions,
}: {
  /** The testID prefix: `<name>-sheet`. */
  name: string;
  title: string;
  subtitle?: string;
  field: ReactNode;
  /** What sits under the field, such as where the grocery came from. */
  notes?: ReactNode;
  /** The Store Product the grocery is priced by, the form's first row. */
  product?: ReactNode;
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
  /** The form view's pinned actions. */
  actions: ReactNode;
}) {
  const intl = useIntl();
  const scheme = useResolvedColorScheme();
  const recurrence = useRecurrenceLabel();
  const [view, setView] = useState<Step>("form");
  const [draft, setDraft] = useState<RecurrencePattern | null>(null);
  const text = (id: string) => intl.formatMessage({ id });
  const store = stores.find((candidate) => candidate.id === storeId) ?? null;
  const dot = (color: string) => storeHue(color)[scheme];
  const aisle = aisles.find((candidate) => candidate.id === aisleId) ?? null;
  const openRepeat = () => {
    setDraft(confirmed);
    setView("repeat");
  };
  const back = () => setView("form");

  if (view === "repeat") {
    return (
      <Sheet
        actions={
          <Sheet.Actions>
            {confirmed ? (
              <Sheet.Action>
                <Button
                  className="h-12"
                  testID="repeat-clear"
                  variant="secondary"
                  onPress={() => {
                    onConfirmed(null);
                    back();
                  }}
                >
                  <Button.Label className="font-medium">
                    {text("common.actions.remove")}
                  </Button.Label>
                </Button>
              </Sheet.Action>
            ) : null}
            <Sheet.Action>
              <Button
                className="h-12"
                isDisabled={!draft}
                testID="repeat-done"
                variant="primary"
                onPress={() => {
                  onConfirmed(draft);
                  back();
                }}
              >
                <Button.Label className="font-semibold">{text("common.actions.done")}</Button.Label>
              </Button>
            </Sheet.Action>
          </Sheet.Actions>
        }
        name={`${name}-repeat`}
        title={text("common.recurrence.title")}
        onClose={back}
      >
        <RepeatBody pattern={draft} onChange={setDraft} />
      </Sheet>
    );
  }

  if (view === "store" || view === "aisle") {
    const choices: Choice[] =
      view === "store"
        ? [
            { id: null, label: text(noStoreLabelId) },
            ...[...stores]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((candidate) => ({
                id: candidate.id,
                label: candidate.name,
                color: dot(candidate.color),
              })),
          ]
        : [
            { id: null, label: text("groceries.panel.noAisle") },
            ...sortAisles(aisles).map((candidate) => ({ id: candidate.id, label: candidate.name })),
          ];

    return (
      <Sheet
        name={`${name}-${view}`}
        title={text(view === "store" ? "groceries.mobile.store" : "groceries.panel.aisle")}
        onClose={back}
      >
        <ChoiceList
          choices={choices}
          prefix={view}
          value={view === "store" ? storeId : aisleId}
          onPick={(id) => {
            if (view === "store") onStore(id);
            else onAisle(id);
            back();
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet actions={actions} name={name} subtitle={subtitle} title={title}>
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
          {product}
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
  );
}
