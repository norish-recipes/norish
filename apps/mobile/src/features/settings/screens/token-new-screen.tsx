import React, { useEffect, useState } from "react";
import { Sheet, SheetBody } from "@/components/sheet";
import { useText } from "@/lib/i18n/use-text";
import { useNavigation, useRouter } from "expo-router";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { siteAuthTokenForm, useSiteAuthTokenMutations } from "@norish/shared-react/reader";

import { ChoiceRow } from "../components/choice-row";
import { OfflineCapsule } from "../components/offline-capsule";
import { SettingsField } from "../components/settings-form";
import { SettingsGroup } from "../components/settings-group";
import { settingsWrite, tellWentThroughLate } from "../utils/settings-write";

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

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !sending });
  }, [navigation, sending]);

  // Closes the sheet while it is in front; an add answered after the release says it went through.
  const added = (late: boolean) => {
    if (!navigation.isFocused()) return;
    if (late) tellWentThroughLate();
    router.back();
  };
  const sendCreate = settingsWrite(
    () => createToken({ domain, account, name, value, type }),
    "token-create",
    undefined,
    (late) => {
      if (late === true) added(true);
    }
  );
  const add = async () => {
    setSending(true);
    const answer = await sendCreate();

    setSending(false);
    if (answer === true) added(false);
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
      name="settings-token-new"
      title={text("settings.user.siteAuthTokens.addButton")}
    >
      <SheetBody contentClassName="gap-4">
        <OfflineCapsule />
        <SettingsField
          autoCapitalize="none"
          autoCorrect={false}
          error={form.domainBare ? text("settings.user.siteAuthTokens.domainNotFull") : null}
          keyboardType="url"
          label={text("settings.user.siteAuthTokens.domain")}
          placeholder={text("settings.user.siteAuthTokens.domainPlaceholder")}
          testID="settings-token-new-domain"
          value={domain}
          onChangeText={setDomain}
        />
        <SettingsField
          autoCapitalize="none"
          autoCorrect={false}
          hint={text("settings.user.siteAuthTokens.accountsDescription")}
          label={text("settings.user.siteAuthTokens.account")}
          placeholder={text("settings.user.siteAuthTokens.accountPlaceholder")}
          testID="settings-token-new-account"
          value={account}
          onChangeText={setAccount}
        />
        <SettingsField
          autoCapitalize="none"
          autoCorrect={false}
          label={text("settings.user.siteAuthTokens.name")}
          placeholder={text("settings.user.siteAuthTokens.namePlaceholder")}
          testID="settings-token-new-name"
          value={name}
          onChangeText={setName}
        />
        <SettingsField
          autoCapitalize="none"
          autoCorrect={false}
          label={text("settings.user.siteAuthTokens.value")}
          placeholder={text("settings.user.siteAuthTokens.valuePlaceholder")}
          secureTextEntry
          testID="settings-token-new-value"
          value={value}
          onChangeText={setValue}
        />
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
            testID="settings-token-new-type"
            title={text("settings.user.siteAuthTokens.type")}
            value={type}
            onChange={setType}
          />
        </SettingsGroup>
      </SheetBody>
    </Sheet>
  );
}
