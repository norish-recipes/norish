import React from "react";
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
import { useDeleteAction } from "../components/use-delete-action";

/** Site tokens: the Reader's header and cookie tokens by domain, Add in a sheet, Delete behind a confirm. */
export function SiteTokensScreen() {
  const text = useText();
  const router = useRouter();
  const deleteAction = useDeleteAction();
  const { tokens, ...read } = useSiteAuthTokensRead();
  const { removeToken } = useSiteAuthTokenMutations();

  return (
    <SettingsPage
      testID="settings-tokens-screen"
      title={text("settings.user.siteAuthTokens.title")}
    >
      <SettingsGroup className="pt-1">
        <SettingsRow
          write
          icon="add-outline"
          testID="token-add"
          title={text("settings.user.siteAuthTokens.addButton")}
          onPress={() => router.push("/settings/token-new")}
        />
      </SettingsGroup>
      <ConnectionList
        count={tokens.length}
        emptyIcon="shield-checkmark-outline"
        emptyTitle={text("settings.user.siteAuthTokens.noTokens")}
        name="tokens"
        read={read}
      >
        <SettingsGroup>
          {orderedSiteTokens(tokens).map((token) => (
            <SettingsRow
              key={token.id}
              actions={[
                deleteAction({
                  modal: "settings.user.siteAuthTokens.deleteModal",
                  id: token.id,
                  send: () => removeToken(token.id),
                }),
              ]}
              menuLabel={token.domain}
              subtitle={`${token.account ?? text("settings.user.siteAuthTokens.accountShared")} · ${token.name}`}
              testID={`token-${token.id}`}
              title={token.domain}
              value={text(
                token.type === "header"
                  ? "settings.user.siteAuthTokens.typeHeader"
                  : "settings.user.siteAuthTokens.typeCookie"
              )}
            />
          ))}
        </SettingsGroup>
      </ConnectionList>
    </SettingsPage>
  );
}
