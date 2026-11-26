import React, { useState } from "react";
import { View } from "react-native";
import { ChoiceCard } from "@/components/choice-card";
import { PillButton } from "@/components/pill-button";
import { FitSheet } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useText } from "@/lib/i18n/use-text";
import { useIntl } from "react-intl";

import type { IngredientPick, PickerOption, Relocation } from "@norish/shared-react/ingredients";
import { useIngredientPicker } from "@norish/shared-react/ingredients";
import { useConnectivity } from "@norish/shared-react/offline/react";

/** Picks the food a merge, a parent or a spelling's move names; the caller owns what the pick does. */
export function FoodPickerStep({
  relocation,
  ingredient,
  onConfirm,
  onBack,
}: {
  relocation: Relocation;
  ingredient: { id: string; name: string };
  onConfirm: (relocation: Relocation, target: IngredientPick) => void;
  onBack: () => void;
}) {
  const text = useText();
  const { locale } = useIntl();
  const [target, setTarget] = useState<PickerOption | null>(null);
  const { isOffline } = useConnectivity();
  const picker = useIngredientPicker({
    excludeId: ingredient.id,
    editableOnly: relocation.kind === "merge",
    locale,
    onPick: setTarget,
  });
  const title = text(
    relocation.kind === "move"
      ? "settings.ingredients.moveTo"
      : relocation.kind === "merge"
        ? "settings.ingredients.mergeInto"
        : "settings.ingredients.setParent"
  );
  const question =
    relocation.kind === "move"
      ? text("settings.ingredients.moveTitle", { alias: relocation.text })
      : relocation.kind === "merge"
        ? text("settings.ingredients.mergeTitle", { name: ingredient.name })
        : text("settings.ingredients.parentTitle", { name: ingredient.name });

  return (
    <FitSheet
      back
      confirm={{
        label: text(
          relocation.kind === "move"
            ? "settings.ingredients.move"
            : relocation.kind === "merge"
              ? "settings.ingredients.merge"
              : "common.actions.apply"
        ),
        // A parent is only a draft; a merge or a move writes at once.
        disabled: !target || (isOffline && relocation.kind !== "parent"),
        onPress: () => {
          if (target) onConfirm(relocation, target);
        },
      }}
      name="food-picker"
      title={title}
      onClose={onBack}
    >
      <SheetNote>{question}</SheetNote>
      <SheetInput
        accessibilityLabel={title}
        autoCapitalize="none"
        placeholder={text("settings.ingredients.pickIngredient")}
        testID="food-picker-input"
        value={picker.term}
        onChangeText={picker.type}
        onClear={() => picker.type("")}
      />
      {picker.hint ? (
        <SheetNote>
          {text(
            picker.hint === "hint"
              ? "settings.ingredients.pickerHint"
              : picker.hint === "searching"
                ? "settings.ingredients.pickerSearching"
                : "settings.ingredients.pickerEmpty"
          )}
        </SheetNote>
      ) : (
        <ChoiceCard
          options={picker.options.map((option) => ({
            id: option.id,
            label: option.name,
            testID: "food-picker-option",
          }))}
          selected={picker.picked}
          onPick={(id) => {
            const option = picker.options.find((each) => each.id === id);

            if (option) picker.pick(option);
          }}
        />
      )}
      {relocation.kind === "move" ? (
        <View>
          <PillButton
            centred
            icon="add"
            label={text("settings.ingredients.newIngredient")}
            testID="food-picker-new"
            onPress={() => onConfirm(relocation, { id: null })}
          />
        </View>
      ) : null}
    </FitSheet>
  );
}
