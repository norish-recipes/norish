import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { PillButton } from "@/components/pill-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useText } from "@/lib/i18n/use-text";
import { useNavigation, useRouter } from "expo-router";
import { TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import {
  API_KEY_NAME_MAX_LENGTH,
  apiKeyName,
  useApiKeyMutations,
} from "@norish/shared-react/reader";

import { OfflineCapsule } from "../components/offline-capsule";
import { settingsWrite } from "../utils/settings-write";

/** The create key sheet. Once made, the key is shown here only, with Copy; from Create until the
 * reader saved it the sheet cannot be closed, and closing it drops the key for good. */
export function ApiKeyNewScreen() {
  const text = useText();
  const intl = useIntl();
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

  // A repeat press shares the held create's outcome; a key answered after the release is dropped,
  // as the reader was told to check the list.
  const sendCreate = settingsWrite(
    () => createApiKey(apiKeyName(name)),
    "api-key-create",
    "settings.user.apiKeys.createNoAnswer",
    (late) => late && forgetCreatedKey()
  );
  const create = async () => {
    setSending(true);
    const key = await sendCreate();

    setSending(false);
    if (key && navigation.isFocused()) setCreated(key);
    else if (key) forgetCreatedKey();
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
        name="api-key-created"
        title={text("settings.user.apiKeys.generatedModal.title")}
      >
        <SheetBody contentClassName="gap-4">
          <OfflineCapsule />
          <Text className="text-warning-ink text-base">
            {text("settings.user.apiKeys.generatedModal.warning")}
          </Text>
          <View className="bg-sand border-stroke rounded-[22px] border-[0.5px] px-4 py-3.5">
            <Text
              selectable
              className="text-foreground font-mono text-[13px]"
              testID="api-key-value"
            >
              {created}
            </Text>
          </View>
          <PillButton
            icon="copy-outline"
            label={text("settings.user.apiKeys.generatedModal.copyButton")}
            testID="api-key-copy"
            onPress={() =>
              void copyToClipboard(created, {
                copied: "settings.user.apiKeys.generatedModal.copied",
              })
            }
          />
          <Text className="text-muted text-sm">
            {intl.formatMessage(
              { id: "settings.user.apiKeys.generatedModal.hint" },
              { code: (chunks) => <Text className="font-mono">{chunks}</Text> }
            )}
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
      name="api-key-new"
      title={text("settings.user.apiKeys.createKey")}
    >
      <SheetBody contentClassName="gap-4">
        <OfflineCapsule />
        <View>
          <LabelWithHint label={text("settings.user.apiKeys.keyNameLabel")} />
          <TextField>
            <SheetInput
              accessibilityLabel={text("settings.user.apiKeys.keyNameLabel")}
              editable={!isOffline}
              maxLength={API_KEY_NAME_MAX_LENGTH}
              placeholder={text("settings.user.apiKeys.keyNamePlaceholder")}
              returnKeyType="done"
              testID="api-key-name"
              value={name}
              onChangeText={setName}
            />
          </TextField>
        </View>
      </SheetBody>
    </Sheet>
  );
}
