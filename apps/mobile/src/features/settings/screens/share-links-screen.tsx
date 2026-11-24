import React from "react";
import { useText } from "@/lib/i18n/use-text";
import { shareEnding } from "@/lib/share-subtitle";
import { useIntl } from "react-intl";

import type { ShareLinkAction } from "@norish/shared-react/recipes";
import {
  shareLinkActions,
  useMyRecipeSharesQuery,
  useRecipeShareMutations,
} from "@norish/shared-react/recipes";

import { ConnectionList } from "../components/connection-list";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { useConfirmedWrite } from "../hooks/use-confirmed-write";

/** Share links: the Reader's public recipe links with their status; Revoke, Reactivate and Delete
 * each behind a confirm. A link's URL is shown once, when it is made, so there is no Copy here. */
export function ShareLinksScreen() {
  const text = useText();
  const intl = useIntl();
  const confirmedWrite = useConfirmedWrite();
  const read = useMyRecipeSharesQuery();
  const { revokeShare, reactivateShare, deleteShare } = useRecipeShareMutations(null);
  const date = (value: Date) => intl.formatDate(value, { dateStyle: "medium" });
  const sendAction: Record<ShareLinkAction, (id: string, version: number) => Promise<boolean>> = {
    revoke: revokeShare,
    reactivate: reactivateShare,
    delete: deleteShare,
  };

  return (
    <SettingsPage
      testID="settings-share-links-screen"
      title={text("settings.user.shareLinks.title")}
    >
      <ConnectionList
        count={read.shares.length}
        emptyIcon="link-outline"
        emptyTitle={text("settings.user.shareLinks.empty")}
        name="settings-share-links"
        read={read}
      >
        <SettingsGroup className="pt-1">
          {read.shares.map((share) => (
            <SettingsRow
              key={share.id}
              actions={shareLinkActions(share.status).map((action) => {
                const modal = `settings.user.shareLinks.${action}Modal`;

                return {
                  kind: action,
                  label: text(`${modal}.confirm`),
                  onPress: confirmedWrite({
                    title: text(`${modal}.title`),
                    message: text(`${modal}.message`, { recipeName: share.recipeName }),
                    confirmLabelId: `${modal}.confirm`,
                    destructive: action === "delete",
                    send: () => sendAction[action](share.id, share.version),
                    key: `${action}:${share.id}`,
                  }),
                };
              })}
              icon="link-outline"
              menuLabel={share.recipeName}
              subtitle={shareEnding(
                share,
                (id, values) => text(`recipes.sharePanel.${id}`, values),
                date
              )}
              testID={`settings-share-links-item-${share.id}`}
              title={share.recipeName}
              value={text(`recipes.sharePanel.status.${share.status}`)}
            />
          ))}
        </SettingsGroup>
      </ConnectionList>
    </SettingsPage>
  );
}
