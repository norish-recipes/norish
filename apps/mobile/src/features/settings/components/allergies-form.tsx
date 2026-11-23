import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { useTokenColor } from "@/hooks/use-token-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useTagsQuery } from "@norish/shared-react/config";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useAllergiesMutation, useAllergiesQuery } from "@norish/shared-react/reader";

import {
  allergySuggestions,
  canSaveAllergies,
  keptAllergyDraft,
  saveAllergies,
  shownAllergies,
  withAllergy,
  withoutAllergy,
} from "../utils/allergy-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** The Reader's allergies as warning chips with a field to add more; Save sends them. */
export function AllergiesForm() {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const saved = useAllergiesQuery();
  const { setAllergies } = useAllergiesMutation();
  const { tags: known } = useTagsQuery();
  const [muted] = useThemeColor(["muted"] as const);
  const warningInk = useTokenColor("warning-foreground");
  const [draft, setDraft] = useState<string[] | null>(null);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const text = (id: string) => intl.formatMessage({ id });
  const kept = keptAllergyDraft({ draft, saved, saving });

  // Dropped while rendering: a draft that sends nothing would hide, and a save undo, another device's change.
  if (kept !== draft) setDraft(kept);
  const shown = shownAllergies(draft, saved);
  const suggestions = allergySuggestions(known, typed, shown);
  const canSave = canSaveAllergies({ draft, saved, saving, offline: isOffline });

  const add = (name: string) => {
    const next = withAllergy(shown, name);

    setTyped("");
    if (next) setDraft(next);
  };
  const save = async () => {
    setSaving(true);
    await saveAllergies({ draft, saved, setAllergies, setDraft });
    setSaving(false);
  };

  return (
    <>
      <View className="pt-4">
        <LabelWithHint
          hint={text("settings.user.allergies.description")}
          label={text("settings.user.allergies.title")}
          testID="allergies-hint"
        />
        <View
          className={`bg-surface flex-row flex-wrap items-center gap-2 rounded-[22px] p-3 ${isOffline ? "opacity-40" : ""}`}
          pointerEvents={isOffline ? "none" : "auto"}
        >
          {shown.map((name) => (
            <View
              key={name}
              className="bg-warning h-9 flex-row items-center rounded-full pr-1 pl-3.5"
              testID={`allergy-${name}`}
            >
              <Text className="text-warning-foreground text-[15px] font-semibold">{name}</Text>
              <Pressable
                accessibilityLabel={intl.formatMessage(
                  { id: "recipes.editor.removeNamed" },
                  { name }
                )}
                accessibilityRole="button"
                className="size-[30px] items-center justify-center"
                onPress={() => setDraft(withoutAllergy(shown, name))}
              >
                <Ionicons color={warningInk} name="close" size={14} />
              </Pressable>
            </View>
          ))}
          <TextInput
            accessibilityLabel={text("settings.user.allergies.placeholder")}
            autoCapitalize="none"
            className="text-foreground h-9 min-w-32 flex-1 py-0 pl-1.5 text-base"
            editable={!isOffline}
            placeholder={shown.length === 0 ? text("settings.user.allergies.placeholder") : ""}
            placeholderTextColor={muted}
            returnKeyType="done"
            submitBehavior="submit"
            testID="allergies-input"
            value={typed}
            onChangeText={(value) => (/[\s,]$/.test(value) ? add(value) : setTyped(value))}
            onSubmitEditing={() => add(typed)}
          />
        </View>
      </View>
      {suggestions.length > 0 ? (
        <SettingsGroup className="pt-2.5">
          {suggestions.map((tag) => (
            <SettingsRow
              key={tag}
              write
              testID={`allergy-suggestion-${tag}`}
              title={tag}
              onPress={() => add(tag)}
            />
          ))}
        </SettingsGroup>
      ) : null}
      <Button
        className="mt-4 h-[50px] rounded-full"
        isDisabled={!canSave}
        testID="allergies-save"
        onPress={() => void save()}
      >
        <Button.Label className="text-base font-semibold">
          {text("common.actions.save")}
        </Button.Label>
      </Button>
    </>
  );
}
