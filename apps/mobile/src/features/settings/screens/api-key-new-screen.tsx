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
import { API_KEY_NAME_MAX_LENGTH, useApiKeyMutations } from "@norish/shared-react/reader";

import { OfflineCapsule } from "../components/offline-capsule";
import { settingsWrite } from "../utils/settings-write";

const T = "settings.user.apiKeys";

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

  const create = async () => {
    setSending(true);
    setCreated(await createApiKey(name.trim() || undefined));
    setSending(false);
  };

  const saved = () => {
    forgetCreatedKey();
    router.back();
  };

  if (created !== null) {
    return (
      <Sheet
        confirm={{
          label: text(`${T}.generatedModal.confirmButton`),
          symbol: "checkmark",
          onPress: saved,
        }}
        closable={false}
        name="api-key-created"
        title={text(`${T}.generatedModal.title`)}
      >
        <SheetBody contentClassName="gap-4">
          <Text className="text-warning-ink text-base">{text(`${T}.generatedModal.warning`)}</Text>
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
            label={text(`${T}.generatedModal.copyButton`)}
            testID="api-key-copy"
            onPress={() => void copyToClipboard(created, { copied: `${T}.generatedModal.copied` })}
          />
          <Text className="text-muted text-sm">
            {intl.formatMessage(
              { id: `${T}.generatedModal.hint` },
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
        label: text(`${T}.createKey`),
        symbol: "plus",
        disabled: isOffline,
        onPress: settingsWrite(create, "api-key-create"),
      }}
      name="api-key-new"
      title={text(`${T}.createKey`)}
    >
      <SheetBody contentClassName="gap-4">
        <OfflineCapsule />
        <View>
          <LabelWithHint label={text(`${T}.keyNameLabel`)} />
          <TextField>
            <SheetInput
              accessibilityLabel={text(`${T}.keyNameLabel`)}
              editable={!isOffline}
              maxLength={API_KEY_NAME_MAX_LENGTH}
              placeholder={text(`${T}.keyNamePlaceholder`)}
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
