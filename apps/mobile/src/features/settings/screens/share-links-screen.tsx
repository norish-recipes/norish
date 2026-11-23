import React from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useText } from "@/lib/i18n/use-text";
import { shareEnding } from "@/lib/share-subtitle";
import { useIntl } from "react-intl";

import { shareLinkActions } from "@norish/shared-react/reader";
import { useMyRecipeSharesQuery, useRecipeShareMutations } from "@norish/shared-react/recipes";

import { ConnectionList } from "../components/connection-list";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { listState } from "../utils/list-state";
import { settingsWrite } from "../utils/settings-write";

const T = "settings.user.shareLinks";

/** Share links: the Reader's public recipe links with their status; Revoke, Reactivate and Delete
 * each behind a confirm. A link's URL is shown once, when it is made, so there is no Copy here. */
export function ShareLinksScreen() {
  const text = useText();
  const intl = useIntl();
  const confirm = useConfirm();
  const { shares, answered, isLoading, error, invalidate } = useMyRecipeSharesQuery();
  const { revokeShare, reactivateShare, deleteShare } = useRecipeShareMutations(null);
  const state = listState({ count: shares.length, answered, isLoading, error });
  const date = (value: Date) => intl.formatDate(value, { dateStyle: "medium" });
  const send = { revoke: revokeShare, reactivate: reactivateShare, delete: deleteShare };

  return (
    <SettingsPage testID="settings-share-links-screen" title={text(`${T}.title`)}>
      <ConnectionList
        emptyIcon="link-outline"
        emptyTitle={text(`${T}.empty`)}
        name="share-links"
        state={state}
        onRetry={invalidate}
      >
        <SettingsGroup className="pt-1">
          {shares.map((share) => (
            <SettingsRow
              key={share.id}
              actions={shareLinkActions(share.status).map((action) => ({
                kind: action,
                label: text(`${T}.${action}Modal.confirm`),
                onPress: () =>
                  confirm({
                    title: text(`${T}.${action}Modal.title`),
                    message: text(`${T}.${action}Modal.message`, { recipeName: share.recipeName }),
                    confirmLabelId: `${T}.${action}Modal.confirm`,
                    destructive: action === "delete",
                    onConfirm: settingsWrite(
                      () => send[action](share.id, share.version),
                      `${action}:${share.id}`
                    ),
                  }),
              }))}
              icon="link-outline"
              menuLabel={share.recipeName}
              subtitle={shareEnding(
                share,
                (id, values) => text(`recipes.sharePanel.${id}`, values),
                date
              )}
              testID={`share-link-${share.id}`}
              title={share.recipeName}
              value={text(`recipes.sharePanel.status.${share.status}`)}
            />
          ))}
        </SettingsGroup>
      </ConnectionList>
    </SettingsPage>
  );
}
