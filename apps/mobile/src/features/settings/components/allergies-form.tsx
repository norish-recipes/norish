import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { useTokenColor } from "@/hooks/use-token-color";
import { useText } from "@/lib/i18n/use-text";
import { isOfflineNow } from "@/lib/offline/offline-now";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Skeleton, useThemeColor } from "heroui-native";

import { useTagsQuery } from "@norish/shared-react/config";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useAllergiesMutation, useAllergiesQuery } from "@norish/shared-react/reader";

import { useDraft } from "../hooks/use-draft";
import {
  ALLERGY_DRAFT,
  allergySuggestions,
  withAllergy,
  withoutAllergy,
} from "../utils/allergy-rules";
import { saveDraft } from "../utils/draft-rules";
import { readState } from "../utils/read-state";
import { FailedLoad } from "./failed-load";
import { SubmitButton } from "./settings-form";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** A space or comma typed after a name adds it. */
const ENDS_NAME = /[\s,]$/;

/** The Reader's allergies as warning chips with a field to add more; Save sends them. */
export function AllergiesForm() {
  const { isOffline } = useConnectivity();
  const { allergies: saved, ...read } = useAllergiesQuery();
  const { setAllergies } = useAllergiesMutation();
  const { tags: known } = useTagsQuery();
  const [muted] = useThemeColor(["muted"] as const);
  const warningInk = useTokenColor("warning-foreground");
  const allergies = useDraft(ALLERGY_DRAFT, saved, { offline: isOffline, key: "allergies-save" });
  const [typed, setTyped] = useState("");
  const text = useText();
  const shown = allergies.shown;
  const suggestions = allergySuggestions(known, typed, shown);

  const add = (name: string) => {
    const next = withAllergy(shown, name);

    setTyped("");
    if (next) allergies.setDraft(next);
  };
  const save = () =>
    allergies.save(() =>
      saveDraft(ALLERGY_DRAFT, {
        draft: allergies.draft,
        saved,
        send: allergies.request(setAllergies),
        setDraft: allergies.setDraft,
        offline: isOfflineNow,
      })
    );

  // Until the list is read there is nothing to edit: a Save would replace the stored allergies.
  const page = readState({ ...read, held: read.answered });

  if (page === "failed") return <FailedLoad name="settings-allergies" onRetry={read.refetch} />;
  if (page === "loading")
    return (
      <View className="pt-4" testID="settings-allergies-loading">
        <Skeleton className="h-[56px] rounded-[22px]" />
      </View>
    );

  return (
    <>
      <View className="pt-4">
        <LabelWithHint
          hint={text("settings.user.allergies.description")}
          label={text("settings.user.allergies.title")}
          testID="settings-allergies-hint"
        />
        <View
          className={`bg-surface flex-row flex-wrap items-center gap-2 rounded-[22px] p-3 ${isOffline ? "opacity-40" : ""}`}
          pointerEvents={isOffline ? "none" : "auto"}
        >
          {shown.map((name) => (
            <View
              key={name}
              className="bg-warning h-9 flex-row items-center rounded-full pr-1 pl-3.5"
              testID={`settings-allergies-allergy-${name}`}
            >
              <Text className="text-warning-foreground text-[15px] font-semibold">{name}</Text>
              <Pressable
                accessibilityLabel={text("recipes.editor.removeNamed", { name })}
                accessibilityRole="button"
                className="size-[30px] items-center justify-center"
                onPress={() => allergies.setDraft(withoutAllergy(shown, name))}
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
            testID="settings-allergies-input"
            value={typed}
            onChangeText={(value) => (ENDS_NAME.test(value) ? add(value) : setTyped(value))}
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
              testID={`settings-allergies-suggestion-${tag}`}
              title={tag}
              onPress={() => add(tag)}
            />
          ))}
        </SettingsGroup>
      ) : null}
      <SubmitButton
        isDisabled={!allergies.canSave()}
        label={text("common.actions.save")}
        testID="settings-allergies-save"
        onPress={() => void save()}
      />
    </>
  );
}
