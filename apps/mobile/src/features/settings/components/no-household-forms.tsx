import React, { useState } from "react";
import { View } from "react-native";
import { useText } from "@/lib/i18n/use-text";

import { useConnectivity } from "@norish/shared-react/offline/react";
import {
  isHouseholdName,
  isJoinCode,
  joinCodeDigits,
  useHouseholdMutations,
} from "@norish/shared-react/reader";

import { settingsWrite } from "../utils/settings-write";
import { SettingsField, SubmitButton } from "./settings-form";

/** One create-or-join form: a labelled field with its description behind a hint, and a button. */
function EntryForm({
  id,
  labelId,
  descriptionId,
  buttonId,
  value,
  onChange,
  onSubmit,
  enabled,
  ...input
}: {
  /** Names the form's test ids. */
  id: "create" | "join";
  labelId: string;
  descriptionId: string;
  buttonId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  enabled: boolean;
  autoCapitalize: "words" | "none";
  keyboardType?: "number-pad";
  placeholder: string;
}) {
  const text = useText();
  const { isOffline } = useConnectivity();

  return (
    <View className="pt-5">
      <SettingsField
        hint={text(descriptionId)}
        label={text(labelId)}
        returnKeyType="done"
        testID={`settings-household-${id}-field`}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={() => enabled && onSubmit()}
        {...input}
      />
      <SubmitButton
        className="mt-3"
        isDisabled={isOffline || !enabled}
        label={text(buttonId)}
        testID={`settings-household-${id}-submit`}
        onPress={onSubmit}
      />
    </View>
  );
}

/** No household: create one by name, or join one with a code. */
export function NoHouseholdForms() {
  const text = useText();
  const { createHousehold, joinHousehold, pending } = useHouseholdMutations();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  // A field keeps its text: on success the forms leave the page, and a late failure can be corrected.
  const sendCreate = settingsWrite(() => createHousehold(name), "create");
  const sendJoin = settingsWrite(() => joinHousehold(code), "join");

  return (
    <>
      <EntryForm
        autoCapitalize="words"
        enabled={isHouseholdName(name) && !pending.create}
        buttonId="settings.household.create.submitButton"
        descriptionId="settings.household.create.description"
        id="create"
        labelId="settings.household.create.nameLabel"
        placeholder={text("settings.household.create.namePlaceholder")}
        value={name}
        onChange={setName}
        onSubmit={() => void sendCreate()}
      />
      <EntryForm
        autoCapitalize="none"
        enabled={isJoinCode(code) && !pending.join}
        buttonId="settings.household.join.submitButton"
        descriptionId="settings.household.join.description"
        id="join"
        keyboardType="number-pad"
        labelId="settings.household.join.codeLabel"
        placeholder={text("settings.household.join.codePlaceholder")}
        value={code}
        onChange={(value) => setCode(joinCodeDigits(value))}
        onSubmit={() => void sendJoin()}
      />
    </>
  );
}
