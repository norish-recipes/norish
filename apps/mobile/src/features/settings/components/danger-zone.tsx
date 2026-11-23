import React from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useIntl } from "react-intl";

import { useDeleteAccountMutation } from "@norish/shared-react/reader";

import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

const DELETE_PARAGRAPHS = ["permanentWarning", "dataWarning", "recipesNote", "adminNote"];

/** Delete account behind a destructive confirm; the app returns to sign-in once it is gone. */
export function DangerZone() {
  const intl = useIntl();
  const confirm = useConfirm();
  const { deleteAccount } = useDeleteAccountMutation();
  const t = (id: string) => intl.formatMessage({ id: `settings.user.dangerZone.${id}` });

  const confirmDelete = () =>
    confirm({
      title: t("deleteModal.title"),
      message: DELETE_PARAGRAPHS.map((id) => t(`deleteModal.${id}`)).join("\n\n"),
      confirmLabelId: "settings.user.dangerZone.deleteModal.confirmButton",
      onConfirm: deleteAccount,
    });

  return (
    <SettingsGroup className="pt-[30px]" title={t("title")}>
      <SettingsRow
        centred
        danger
        icon="trash-outline"
        testID="profile-delete-account"
        title={t("deleteButton")}
        write
        onPress={confirmDelete}
      />
    </SettingsGroup>
  );
}
