import React from "react";
import { useText } from "@/lib/i18n/use-text";

import { useDeleteAccountMutation } from "@norish/shared-react/reader";

import { useConfirmedWrite } from "../hooks/use-confirmed-write";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

const DELETE_PARAGRAPHS = ["permanentWarning", "dataWarning", "recipesNote", "adminNote"];

/** Delete account behind a destructive confirm; the app returns to sign-in once it is gone. */
export function DangerZone() {
  const text = useText();
  const confirmedWrite = useConfirmedWrite();
  const { deleteAccount } = useDeleteAccountMutation();

  const confirmDelete = confirmedWrite({
    title: text("settings.user.dangerZone.deleteModal.title"),
    message: DELETE_PARAGRAPHS.map((id) => text(`settings.user.dangerZone.deleteModal.${id}`)).join(
      "\n\n"
    ),
    confirmLabelId: "settings.user.dangerZone.deleteModal.confirmButton",
    send: deleteAccount,
  });

  return (
    <SettingsGroup className="pt-[30px]" title={text("settings.user.dangerZone.title")}>
      <SettingsRow
        centred
        danger
        icon="trash-outline"
        testID="settings-profile-delete-account"
        title={text("settings.user.dangerZone.deleteButton")}
        write
        onPress={confirmDelete}
      />
    </SettingsGroup>
  );
}
