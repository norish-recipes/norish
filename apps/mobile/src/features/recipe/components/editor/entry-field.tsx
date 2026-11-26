import React, { useState } from "react";
import { Text, View } from "react-native";
import { ToggleChip } from "@/components/toggle-chip";
import { useText } from "@/lib/i18n/use-text";

import type { PickerEntry, PickerKind } from "@norish/shared-react/lists";
import { useEntryPicker } from "@norish/shared-react/lists";

import { EditorInput } from "./editor-parts";

/** How many matches show under the field. */
const SHOWN = 6;

/** A field that searches a list as you type; only its "Create 'x'" chip makes an entry, Returning
 * picks one typed in full. */
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
  const { offer, problem } = picker;
  const searching = typed.trim() !== "";
  const matches = searching ? picker.matches.slice(0, SHOWN) : [];
  // Return takes the entry named in full, never makes one.
  const pickWhatIsTyped = () => {
    if (picker.exactMatch) picker.pick(picker.exactMatch);
  };

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
        onSubmitEditing={pickWhatIsTyped}
      />
      {matches.length > 0 || offer.kind === "create" ? (
        <View className="flex-row flex-wrap gap-2">
          {matches.map((entry) => (
            <ToggleChip
              key={entry.id}
              active={false}
              label={entryLabel ? entryLabel(entry.name) : entry.name}
              testID={`${testID}-match-${entry.id}`}
              onPress={() => picker.pick(entry)}
            />
          ))}
          {offer.kind === "create" ? (
            <ToggleChip
              active={false}
              disabled={picker.createDisabled}
              icon="add"
              label={text(`recipes.picker.${picker.createLabelKey}`, { name: offer.name })}
              testID={`${testID}-create`}
              onPress={() => void picker.createAndSelect()}
            />
          ) : null}
        </View>
      ) : null}
      {problem ? (
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-danger text-[13px] font-medium">
            {text(`recipes.picker.${problem.key}`, problem.values)}
          </Text>
          {problem.key === "loadFailed" ? (
            <ToggleChip
              active={false}
              label={text("common.actions.retry")}
              testID={`${testID}-retry`}
              onPress={picker.retryList}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
