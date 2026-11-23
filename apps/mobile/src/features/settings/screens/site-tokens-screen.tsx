import React from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useText } from "@/lib/i18n/use-text";
import { useRouter } from "expo-router";

import {
  orderedSiteTokens,
  useSiteAuthTokenMutations,
  useSiteAuthTokensRead,
} from "@norish/shared-react/reader";

import { ConnectionList } from "../components/connection-list";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { listState } from "../utils/list-state";
import { settingsWrite } from "../utils/settings-write";

const T = "settings.user.siteAuthTokens";

/** Site tokens: the Reader's header and cookie tokens by domain, Add in a sheet, Delete behind a confirm. */
export function SiteTokensScreen() {
  const text = useText();
  const router = useRouter();
  const confirm = useConfirm();
  const { tokens, answered, isLoading, error, refetch } = useSiteAuthTokensRead();
  const { removeToken } = useSiteAuthTokenMutations();
  const state = listState({ count: tokens.length, answered, isLoading, error });

  return (
    <SettingsPage testID="settings-tokens-screen" title={text(`${T}.title`)}>
      <SettingsGroup className="pt-1">
        <SettingsRow
          write
          icon="add-outline"
          testID="token-add"
          title={text(`${T}.addButton`)}
          onPress={() => router.push("/settings/token-new")}
        />
      </SettingsGroup>
      <ConnectionList
        emptyIcon="shield-checkmark-outline"
        emptyTitle={text(`${T}.noTokens`)}
        name="tokens"
        state={state}
        onRetry={refetch}
      >
        <SettingsGroup>
          {orderedSiteTokens(tokens).map((token) => (
            <SettingsRow
              key={token.id}
              actions={[
                {
                  kind: "delete",
                  label: text("common.actions.delete"),
                  onPress: () =>
                    confirm({
                      title: text(`${T}.deleteModal.title`),
                      message: text(`${T}.deleteModal.message`),
                      confirmLabelId: `${T}.deleteModal.confirmButton`,
                      onConfirm: settingsWrite(() => removeToken(token.id), `delete:${token.id}`),
                    }),
                },
              ]}
              menuLabel={token.domain}
              subtitle={`${token.account ?? text(`${T}.accountShared`)} · ${token.name}`}
              testID={`token-${token.id}`}
              title={token.domain}
              value={text(token.type === "header" ? `${T}.typeHeader` : `${T}.typeCookie`)}
            />
          ))}
        </SettingsGroup>
      </ConnectionList>
    </SettingsPage>
  );
}
