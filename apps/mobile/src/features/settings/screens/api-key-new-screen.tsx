import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { OfflineCapsule } from "@/components/offline-capsule";
import { PillButton } from "@/components/pill-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useText } from "@/lib/i18n/use-text";
import { useNavigation, useRouter } from "expo-router";
import { FormattedMessage } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import {
  API_KEY_NAME_MAX_LENGTH,
  apiKeyName,
  useApiKeyMutations,
} from "@norish/shared-react/reader";

import { SettingsField } from "../components/settings-form";
import { settingsWrite, tellWentThroughLate } from "../utils/settings-write";

/** The create key sheet. Once made, the key is shown here only, with Copy; from Create until the
 * reader saved it the sheet cannot be closed, and closing it drops the key for good. */
export function ApiKeyNewScreen() {
  const text = useText();
  const router = useRouter();
  const navigation = useNavigation();
  const copyToClipboard = useCopyToClipboard();
  const { isOffline } = useConnectivity();
  const { createApiKey, forgetCreatedKey } = useApiKeyMutations();
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const locked = sending || created !== null;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !locked });
  }, [navigation, locked]);

  // The key is shown while this sheet is in front, one answered after the release saying it went
  // through; a sheet gone forgets it.
  const made = (key: string, late: boolean) => {
    if (!navigation.isFocused()) return forgetCreatedKey();
    if (late) tellWentThroughLate();
    setCreated(key);
  };
  const sendCreate = settingsWrite(
    () => createApiKey(apiKeyName(name)),
    "api-key-create",
    "settings.user.apiKeys.createNoAnswer",
    (late) => {
      if (typeof late === "string") made(late, true);
    }
  );
  const create = async () => {
    setSending(true);
    const key = await sendCreate();

    setSending(false);
    if (typeof key === "string") made(key, false);
  };

  const saved = () => {
    forgetCreatedKey();
    router.back();
  };

  if (created !== null) {
    return (
      <Sheet
        confirm={{
          label: text("settings.user.apiKeys.generatedModal.confirmButton"),
          symbol: "checkmark",
          onPress: saved,
        }}
        closable={false}
        name="settings-api-key-new-created"
        title={text("settings.user.apiKeys.generatedModal.title")}
      >
        <SheetBody>
          <OfflineCapsule />
          <Text className="text-warning-ink text-base">
            {text("settings.user.apiKeys.generatedModal.warning")}
          </Text>
          <View className="bg-sand border-stroke rounded-[22px] border-[0.5px] px-4 py-3.5">
            <Text
              selectable
              className="text-foreground font-mono text-[13px]"
              testID="settings-api-key-new-value"
            >
              {created}
            </Text>
          </View>
          <PillButton
            icon="copy-outline"
            label={text("settings.user.apiKeys.generatedModal.copyButton")}
            testID="settings-api-key-new-copy"
            onPress={() =>
              void copyToClipboard(created, {
                copied: "settings.user.apiKeys.generatedModal.copied",
              })
            }
          />
          <Text className="text-muted text-sm">
            <FormattedMessage
              id="settings.user.apiKeys.generatedModal.hint"
              values={{ code: (chunks) => <Text className="font-mono">{chunks}</Text> }}
            />
          </Text>
        </SheetBody>
      </Sheet>
    );
  }

  return (
    <Sheet
      closable={!locked}
      confirm={{
        label: text("settings.user.apiKeys.createKey"),
        symbol: "plus",
        disabled: isOffline,
        onPress: () => void create(),
      }}
      name="settings-api-key-new"
      title={text("settings.user.apiKeys.createKey")}
    >
      <SheetBody>
        <OfflineCapsule />
        <SettingsField
          label={text("settings.user.apiKeys.keyNameLabel")}
          maxLength={API_KEY_NAME_MAX_LENGTH}
          placeholder={text("settings.user.apiKeys.keyNamePlaceholder")}
          returnKeyType="done"
          testID="settings-api-key-new-name"
          value={name}
          onChangeText={setName}
        />
      </SheetBody>
    </Sheet>
  );
}
