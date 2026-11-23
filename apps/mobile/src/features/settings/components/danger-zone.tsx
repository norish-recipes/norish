import React from "react";
import { Alert } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useIntl } from "react-intl";

import { useDeleteAccountMutation, useHousehold } from "@norish/shared-react/reader";

import { deleteMessageIds, showsAdminNote } from "../utils/profile-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** Delete account behind a destructive confirm; the app returns to sign-in once it is gone. */
export function DangerZone() {
  const intl = useIntl();
  const cancel = useCancelButton();
  const { deleteAccount } = useDeleteAccountMutation();
  const { household, isAdmin, isLoading } = useHousehold();
  const t = (id: string) => intl.formatMessage({ id: `settings.user.dangerZone.${id}` });

  const confirm = () =>
    Alert.alert(
      t("deleteModal.title"),
      deleteMessageIds(showsAdminNote(household, isAdmin, isLoading))
        .map((id) => intl.formatMessage({ id }))
        .join("\n\n"),
      [
        cancel,
        { text: t("deleteModal.confirmButton"), style: "destructive", onPress: deleteAccount },
      ]
    );

  return (
    <SettingsGroup className="pt-[30px]" title={t("title")}>
      <SettingsRow
        centred
        danger
        icon="trash-outline"
        testID="profile-delete-account"
        title={t("deleteButton")}
        write
        onPress={confirm}
      />
    </SettingsGroup>
  );
}
