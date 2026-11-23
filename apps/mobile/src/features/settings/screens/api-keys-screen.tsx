import React from "react";
import { Linking } from "react-native";
import { useConfirm } from "@/hooks/use-confirm";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { apiKeyPrefix, useApiKeyMutations, useProfileQuery } from "@norish/shared-react/reader";

import { ConnectionList } from "../components/connection-list";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { listState } from "../utils/list-state";
import { settingsWrite } from "../utils/settings-write";

const T = "settings.user.apiKeys";
const API_DOCS_URL = "https://docs.norish.dev/reference/api";

/** API keys: the Reader's keys by their first characters, Create in a sheet, Disable or Enable at once, Delete behind a confirm. */
export function ApiKeysScreen() {
  const text = useText();
  const intl = useIntl();
  const router = useRouter();
  const confirm = useConfirm();
  const { apiKeys, answered, isLoading, error, refetch } = useProfileQuery();
  const { deleteApiKey, toggleApiKey } = useApiKeyMutations();
  const state = listState({ count: apiKeys.length, answered, isLoading, error });

  return (
    <SettingsPage testID="settings-api-keys-screen" title={text(`${T}.title`)}>
      <SettingsGroup className="pt-1">
        <SettingsRow
          write
          icon="add-outline"
          testID="api-key-add"
          title={text(`${T}.createKey`)}
          onPress={() => router.push("/settings/api-key-new")}
        />
      </SettingsGroup>
      <ConnectionList
        emptyIcon="key-outline"
        emptyTitle={text(`${T}.noKeys`)}
        name="api-keys"
        state={state}
        onRetry={refetch}
      >
        <SettingsGroup title={text(`${T}.yourKeys`)}>
          {apiKeys.map((key) => {
            const name = key.name || text(`${T}.unnamed`);

            return (
              <SettingsRow
                key={key.id}
                actions={[
                  {
                    kind: key.enabled ? "disable" : "enable",
                    label: text(key.enabled ? `${T}.disableKey` : `${T}.enableKey`),
                    onPress: settingsWrite(
                      () => toggleApiKey(key.id, !key.enabled),
                      `toggle:${key.id}`
                    ),
                  },
                  {
                    kind: "delete",
                    label: text("common.actions.delete"),
                    onPress: () =>
                      confirm({
                        title: text(`${T}.deleteModal.title`),
                        message: text(`${T}.deleteModal.message`),
                        confirmLabelId: `${T}.deleteModal.confirmButton`,
                        onConfirm: settingsWrite(() => deleteApiKey(key.id), `delete:${key.id}`),
                      }),
                  },
                ]}
                menuLabel={name}
                subtitle={`${apiKeyPrefix(key.start)} · ${intl.formatDate(new Date(key.createdAt), { dateStyle: "medium" })}`}
                testID={`api-key-${key.id}`}
                title={name}
                value={text(key.enabled ? `${T}.active` : `${T}.disabled`)}
              />
            );
          })}
        </SettingsGroup>
      </ConnectionList>
      <SettingsGroup>
        <SettingsRow
          accessory="external"
          icon="document-text-outline"
          testID="api-key-docs"
          title={text(`${T}.docsLink`)}
          onPress={() => void Linking.openURL(API_DOCS_URL)}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
