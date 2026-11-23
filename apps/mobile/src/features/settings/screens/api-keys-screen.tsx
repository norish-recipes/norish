import React from "react";
import { Linking } from "react-native";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import { apiKeyPrefix, useApiKeyMutations, useProfileQuery } from "@norish/shared-react/reader";

import { ConnectionList } from "../components/connection-list";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { useDeleteAction } from "../components/use-delete-action";
import { settingsWrite } from "../utils/settings-write";

const API_DOCS_URL = "https://docs.norish.dev/reference/api";

/** API keys: the Reader's keys by their first characters, Create in a sheet, Disable or Enable at once, Delete behind a confirm. */
export function ApiKeysScreen() {
  const text = useText();
  const intl = useIntl();
  const router = useRouter();
  const deleteAction = useDeleteAction();
  const profile = useProfileQuery();
  const { deleteApiKey, toggleApiKey } = useApiKeyMutations();

  return (
    <SettingsPage testID="settings-api-keys-screen" title={text("settings.user.apiKeys.title")}>
      <SettingsGroup className="pt-1">
        <SettingsRow
          write
          icon="add-outline"
          testID="api-key-add"
          title={text("settings.user.apiKeys.createKey")}
          onPress={() => router.push("/settings/api-key-new")}
        />
      </SettingsGroup>
      <ConnectionList
        count={profile.apiKeys.length}
        emptyIcon="key-outline"
        emptyTitle={text("settings.user.apiKeys.noKeys")}
        name="api-keys"
        read={profile}
      >
        <SettingsGroup title={text("settings.user.apiKeys.yourKeys")}>
          {profile.apiKeys.map((key) => {
            const name = key.name || text("settings.user.apiKeys.unnamed");

            return (
              <SettingsRow
                key={key.id}
                actions={[
                  {
                    kind: key.enabled ? "disable" : "enable",
                    label: text(
                      key.enabled
                        ? "settings.user.apiKeys.disableKey"
                        : "settings.user.apiKeys.enableKey"
                    ),
                    onPress: settingsWrite(
                      () => toggleApiKey(key.id, !key.enabled),
                      `toggle:${key.id}`
                    ),
                  },
                  deleteAction({
                    modal: "settings.user.apiKeys.deleteModal",
                    id: key.id,
                    send: () => deleteApiKey(key.id),
                  }),
                ]}
                menuLabel={name}
                subtitle={`${apiKeyPrefix(key.start)} · ${intl.formatDate(new Date(key.createdAt), { dateStyle: "medium" })}`}
                testID={`api-key-${key.id}`}
                title={name}
                value={text(
                  key.enabled ? "settings.user.apiKeys.active" : "settings.user.apiKeys.disabled"
                )}
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
          title={text("settings.user.apiKeys.docsLink")}
          onPress={() => void Linking.openURL(API_DOCS_URL)}
        />
      </SettingsGroup>
    </SettingsPage>
  );
}
