import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useText } from "@/lib/i18n/use-text";
import { useNavigation, useRouter } from "expo-router";
import { TextField } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { siteAuthTokenForm, useSiteAuthTokenMutations } from "@norish/shared-react/reader";

import { ChoiceRow } from "../components/choice-row";
import { OfflineCapsule } from "../components/offline-capsule";
import { SettingsGroup } from "../components/settings-group";
import { settingsWrite } from "../utils/settings-write";

const TYPES = ["header", "cookie"] as const;

/** The add token sheet, mounted per opening so a closed sheet keeps no token value. A token that
 * is not added stays typed; the sheet stays open while it is being added. */
export function TokenNewScreen() {
  const text = useText();
  const router = useRouter();
  const navigation = useNavigation();
  const { isOffline } = useConnectivity();
  const { createToken } = useSiteAuthTokenMutations();
  const [domain, setDomain] = useState("");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("header");
  const [sending, setSending] = useState(false);
  const form = siteAuthTokenForm({ domain, name, value });

  const field = ({
    label,
    testID,
    value: typed,
    onChange,
    hint,
    placeholder,
    secure = false,
    url = false,
  }: {
    label: string;
    testID: string;
    value: string;
    onChange: (typed: string) => void;
    hint?: string;
    placeholder: string;
    secure?: boolean;
    url?: boolean;
  }) => (
    <View>
      <LabelWithHint hint={hint} label={label} testID={hint ? `${testID}-hint` : undefined} />
      <TextField>
        <SheetInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isOffline}
          keyboardType={url ? "url" : "default"}
          placeholder={placeholder}
          secureTextEntry={secure}
          testID={testID}
          value={typed}
          onChangeText={onChange}
        />
      </TextField>
    </View>
  );

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !sending });
  }, [navigation, sending]);

  const sendCreate = settingsWrite(
    () => createToken({ domain, account, name, value, type }),
    "token-create"
  );
  const add = async () => {
    setSending(true);
    const added = await sendCreate();

    setSending(false);
    if (added && navigation.isFocused()) router.back();
  };

  return (
    <Sheet
      closable={!sending}
      confirm={{
        label: text("settings.user.siteAuthTokens.addButton"),
        symbol: "plus",
        disabled: !form.valid || isOffline || sending,
        onPress: () => void add(),
      }}
      name="token-new"
      title={text("settings.user.siteAuthTokens.addButton")}
    >
      <SheetBody contentClassName="gap-4">
        <OfflineCapsule />
        <View>
          {field({
            label: text("settings.user.siteAuthTokens.domain"),
            testID: "token-domain",
            value: domain,
            onChange: setDomain,
            placeholder: text("settings.user.siteAuthTokens.domainPlaceholder"),
            url: true,
          })}
          {form.domainBare ? (
            <Text className="text-danger px-2 pt-1.5 text-[13px]">
              {text("settings.user.siteAuthTokens.domainNotFull")}
            </Text>
          ) : null}
        </View>
        {field({
          label: text("settings.user.siteAuthTokens.account"),
          testID: "token-account",
          value: account,
          onChange: setAccount,
          hint: text("settings.user.siteAuthTokens.accountsDescription"),
          placeholder: text("settings.user.siteAuthTokens.accountPlaceholder"),
        })}
        {field({
          label: text("settings.user.siteAuthTokens.name"),
          testID: "token-name",
          value: name,
          onChange: setName,
          placeholder: text("settings.user.siteAuthTokens.namePlaceholder"),
        })}
        {field({
          label: text("settings.user.siteAuthTokens.value"),
          testID: "token-value",
          value,
          onChange: setValue,
          placeholder: text("settings.user.siteAuthTokens.valuePlaceholder"),
          secure: true,
        })}
        <SettingsGroup className="pt-0">
          <ChoiceRow
            optionLabel={(option) =>
              text(
                option === "header"
                  ? "settings.user.siteAuthTokens.typeHeader"
                  : "settings.user.siteAuthTokens.typeCookie"
              )
            }
            options={TYPES}
            testID="token-type"
            title={text("settings.user.siteAuthTokens.type")}
            value={type}
            onChange={setType}
          />
        </SettingsGroup>
      </SheetBody>
    </Sheet>
  );
}
