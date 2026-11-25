import React, { useState } from "react";
import { Text, View } from "react-native";
import { ToggleChip } from "@/components/toggle-chip";
import { useText } from "@/lib/i18n/use-text";

import type { PickerEntry, PickerKind } from "@norish/shared-react/lists";
import { useEntryPicker } from "@norish/shared-react/lists";
import { entryFold } from "@norish/shared/lib/fold-name";

import { EditorInput } from "./editor-parts";

/** How many matches show under the field. */
const SHOWN = 6;

/**
 * A field that searches a list as you type: the entries that match come first, then a
 * "Create 'x'" chip where the list has no entry of that name. Returning picks an entry typed in
 * full; only the Create chip makes one.
 */
export function EntryField({
  kind,
  recipeId,
  isSelected,
  onSelect,
  label,
  placeholder,
  testID,
  entryLabel,
}: {
  kind: PickerKind;
  /** The recipe being edited, once it exists: its household's list is the one offered. */
  recipeId?: string;
  isSelected: (entry: PickerEntry) => boolean;
  onSelect: (entry: PickerEntry) => void;
  label: string;
  placeholder: string;
  testID: string;
  entryLabel?: (name: string) => string;
}) {
  const text = useText();
  const [typed, setTyped] = useState("");
  const picker = useEntryPicker({
    kind,
    recipeId,
    typed,
    isSelected,
    onSelect: (entry) => {
      onSelect(entry);
      setTyped("");
    },
  });
  const { offer } = picker;
  const searching = typed.trim() !== "";
  const matches = searching ? picker.matches.slice(0, SHOWN) : [];
  const pick = (entry: PickerEntry) => {
    onSelect(entry);
    setTyped("");
  };
  // Return takes the entry named in full, never makes one.
  const submit = () => {
    const whole = picker.matches.find((entry) => entryFold(entry.name) === entryFold(typed));

    if (whole) pick(whole);
  };
  const problem =
    offer.kind === "tooLong"
      ? text("recipes.picker.tooLong", { max: offer.max })
      : picker.createFailed && offer.kind === "create"
        ? text("recipes.picker.createFailed", { name: offer.name })
        : null;

  return (
    <View className="gap-2">
      <EditorInput
        accessibilityLabel={label}
        autoCapitalize="none"
        className="text-foreground h-[34px] min-w-32 py-0 text-[15px]"
        placeholder={placeholder}
        returnKeyType="done"
        submitBehavior="submit"
        testID={testID}
        value={typed}
        onChangeText={setTyped}
        onSubmitEditing={submit}
      />
      {matches.length > 0 || offer.kind === "create" ? (
        <View className="flex-row flex-wrap gap-2">
          {matches.map((entry) => (
            <ToggleChip
              key={entry.id}
              active={false}
              label={entryLabel ? entryLabel(entry.name) : entry.name}
              testID={`${testID}-match-${entry.id}`}
              onPress={() => pick(entry)}
            />
          ))}
          {offer.kind === "create" ? (
            <ToggleChip
              active={false}
              disabled={picker.createDisabled}
              icon="add"
              label={
                picker.isOffline
                  ? text("recipes.picker.createOffline", { name: offer.name })
                  : text("recipes.picker.create", { name: offer.name })
              }
              testID={`${testID}-create`}
              onPress={() => void picker.createAndSelect()}
            />
          ) : null}
        </View>
      ) : null}
      {problem ? <Text className="text-danger text-[13px] font-medium">{problem}</Text> : null}
    </View>
  );
}
