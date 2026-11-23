import React, { useState } from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { TextField } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { siteTokenForm, useSiteAuthTokenMutations } from "@norish/shared-react/reader";

import { ChoiceRow } from "../components/choice-row";
import { SettingsGroup } from "../components/settings-group";
import { settingsWrite } from "../utils/settings-write";

const T = "settings.user.siteAuthTokens";
const TYPES = ["header", "cookie"] as const;

/** The add token sheet, mounted per opening so a closed sheet keeps no token value. A token that
 * is not added stays typed. */
export function TokenNewScreen() {
  const text = useText();
  const router = useRouter();
  const { isOffline } = useConnectivity();
  const { createToken } = useSiteAuthTokenMutations();
  const [domain, setDomain] = useState("");
  const [account, setAccount] = useState("");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("header");
  const form = siteTokenForm({ domain, name, value });

  const field = (
    label: string,
    testID: string,
    text_: string,
    set: (value: string) => void,
    props: { hint?: string; placeholder: string; secure?: boolean; url?: boolean }
  ) => (
    <View>
      <LabelWithHint
        hint={props.hint}
        label={label}
        testID={props.hint ? `${testID}-hint` : undefined}
      />
      <TextField>
        <SheetInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isOffline}
          keyboardType={props.url ? "url" : "default"}
          placeholder={props.placeholder}
          secureTextEntry={props.secure}
          testID={testID}
          value={text_}
          onChangeText={set}
        />
      </TextField>
    </View>
  );

  const add = async () => {
    if (await createToken({ domain, account, name, value, type })) router.back();
  };

  return (
    <Sheet
      confirm={{
        label: text(`${T}.addButton`),
        symbol: "plus",
        disabled: !form.valid || isOffline,
        onPress: settingsWrite(add, "token-create"),
      }}
      name="token-new"
      title={text(`${T}.addButton`)}
    >
      <SheetBody contentClassName="gap-4">
        <View>
          {field(text(`${T}.domain`), "token-domain", domain, setDomain, {
            placeholder: text(`${T}.domainPlaceholder`),
            url: true,
          })}
          {form.domainBare ? (
            <Text className="text-danger px-2 pt-1.5 text-[13px]">
              {text(`${T}.domainNotFull`)}
            </Text>
          ) : null}
        </View>
        {field(text(`${T}.account`), "token-account", account, setAccount, {
          hint: text(`${T}.accountsDescription`),
          placeholder: text(`${T}.accountPlaceholder`),
        })}
        {field(text(`${T}.name`), "token-name", name, setName, {
          placeholder: text(`${T}.namePlaceholder`),
        })}
        {field(text(`${T}.value`), "token-value", value, setValue, {
          placeholder: text(`${T}.valuePlaceholder`),
          secure: true,
        })}
        <SettingsGroup className="pt-0">
          <ChoiceRow
            optionLabel={(option) =>
              text(option === "header" ? `${T}.typeHeader` : `${T}.typeCookie`)
            }
            options={TYPES}
            testID="token-type"
            title={text(`${T}.type`)}
            value={type}
            onChange={setType}
          />
        </SettingsGroup>
      </SheetBody>
    </Sheet>
  );
}
