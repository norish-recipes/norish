import React, { useState } from "react";
import { View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { SheetInput } from "@/components/sheet-input";
import { Button, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { isJoinCode, useHouseholdMutations } from "@norish/shared-react/reader";

import { useSettingsWrite } from "../hooks/use-settings-write";
import { canCreate } from "../utils/household-rules";

/** One create-or-join form: a labelled field with its description behind a hint, and a button. */
function EntryForm({
  id,
  field,
  value,
  onChange,
  onSubmit,
  enabled,
  ...input
}: {
  id: "create" | "join";
  field: "nameLabel" | "codeLabel";
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  enabled: boolean;
  autoCapitalize: "words" | "none";
  keyboardType?: "number-pad";
  maxLength?: number;
  placeholder: string;
}) {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const t = (key: string) => intl.formatMessage({ id: `settings.household.${id}.${key}` });

  return (
    <View className="pt-5">
      <LabelWithHint hint={t("description")} label={t(field)} testID={`household-${id}-hint`} />
      <TextField>
        <SheetInput
          accessibilityLabel={t(field)}
          editable={!isOffline}
          returnKeyType="done"
          testID={`household-${id}-field`}
          value={value}
          onChangeText={onChange}
          onSubmitEditing={() => enabled && onSubmit()}
          {...input}
        />
      </TextField>
      <Button
        className="mt-3 h-[50px] rounded-full"
        isDisabled={isOffline || !enabled}
        testID={`household-${id}-submit`}
        onPress={onSubmit}
      >
        <Button.Label className="text-base font-semibold">{t("submitButton")}</Button.Label>
      </Button>
    </View>
  );
}

/** No household: create one by name, or join one with a code. */
export function NoHouseholdForms() {
  const intl = useIntl();
  const { createHousehold, joinHousehold, pending } = useHouseholdMutations();
  const write = useSettingsWrite();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const t = (id: string) => intl.formatMessage({ id: `settings.household.${id}` });

  return (
    <>
      <EntryForm
        autoCapitalize="words"
        enabled={canCreate(name) && !pending.create}
        field="nameLabel"
        id="create"
        placeholder={t("create.namePlaceholder")}
        value={name}
        onChange={setName}
        onSubmit={write(() => {
          createHousehold(name);
          setName("");
        })}
      />
      <EntryForm
        autoCapitalize="none"
        enabled={isJoinCode(code) && !pending.join}
        field="codeLabel"
        id="join"
        keyboardType="number-pad"
        maxLength={6}
        placeholder={t("join.codePlaceholder")}
        value={code}
        onChange={(value) => setCode(value.replace(/\D/g, ""))}
        onSubmit={write(() => {
          joinHousehold(code);
          setCode("");
        })}
      />
    </>
  );
}
