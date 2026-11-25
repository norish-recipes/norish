import React, { useState } from "react";
import { View } from "react-native";
import { useText } from "@/lib/i18n/use-text";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { isJoinCode, joinCodeDigits, useHouseholdMutations } from "@norish/shared-react/reader";

import { settingsWrite } from "../utils/settings-write";
import { SettingsField, SubmitButton } from "./settings-form";

/** Join another household with its code: offered while the Reader's household is just them. */
export function JoinHouseholdForm() {
  const text = useText();
  const { isOffline } = useConnectivity();
  const { joinHousehold, pending } = useHouseholdMutations();
  const [code, setCode] = useState("");
  // The field keeps its text: on success the form leaves the page, and a late failure can be corrected.
  const sendJoin = settingsWrite(() => joinHousehold(code), "join");
  const enabled = isJoinCode(code) && !pending.join;

  return (
    <View className="pt-5">
      <SettingsField
        autoCapitalize="none"
        hint={text("settings.household.join.description")}
        keyboardType="number-pad"
        label={text("settings.household.join.codeLabel")}
        placeholder={text("settings.household.join.codePlaceholder")}
        returnKeyType="done"
        testID="settings-household-join-field"
        value={code}
        onChangeText={(value) => setCode(joinCodeDigits(value))}
        onSubmitEditing={() => {
          if (enabled) void sendJoin();
        }}
      />
      <SubmitButton
        className="mt-3"
        isDisabled={isOffline || !enabled}
        label={text("settings.household.join.submitButton")}
        testID="settings-household-join-submit"
        onPress={() => void sendJoin()}
      />
    </View>
  );
}
