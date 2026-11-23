import React from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useConfirm } from "@/hooks/use-confirm";
import { useIntl } from "react-intl";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";
import { useHouseholdMutations } from "@norish/shared-react/reader";

import { useSettingsWrite } from "../hooks/use-settings-write";
import { memberActions } from "../utils/household-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** The household's members with their role; an admin swipes or long-presses another member for
 * Kick and Make admin, each behind a confirm. */
export function MembersList({
  household,
  currentUserId,
  isAdmin,
}: {
  household: HouseholdSettingsDto;
  currentUserId: string | undefined;
  isAdmin: boolean;
}) {
  const intl = useIntl();
  const confirm = useConfirm();
  const { kickUser, transferAdmin, pending } = useHouseholdMutations();
  const write = useSettingsWrite();
  const t = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id: `settings.household.${id}` }, values);

  return (
    <SettingsGroup title={t("members.title")}>
      {household.users.map((user) => {
        const isSelf = user.id === currentUserId;
        const name = user.name || t("members.unknown");
        const kinds = memberActions(isAdmin, isSelf, user.isAdmin === true);
        const actions = kinds.map((kind) =>
          kind === "kick"
            ? {
                kind,
                label: t("members.kickButton"),
                onPress: () =>
                  confirm({
                    title: t("members.kickModal.title"),
                    message: `${t("members.kickModal.confirmMessage", { name })}\n\n${t("members.kickModal.warning")}`,
                    confirmLabelId: "settings.household.members.kickModal.confirmButton",
                    onConfirm: write(() => !pending.kick && kickUser(household.id, user.id)),
                  }),
              }
            : {
                kind,
                label: t("members.makeAdminButton"),
                onPress: () =>
                  confirm({
                    title: t("members.transferModal.title"),
                    message: `${t("members.transferModal.confirmMessage", { name })}\n\n${t("members.transferModal.warning")}`,
                    confirmLabelId: "settings.household.members.transferModal.confirmButton",
                    onConfirm: write(() => !pending.transfer && transferAdmin(household.id, user.id)),
                  }),
              }
        );

        return (
          <SettingsRow
            key={user.id}
            actions={actions}
            leading={
              <UserAvatar
                className="size-[34px]"
                initialClassName="text-[15px]"
                name={name}
                source={null}
              />
            }
            menuLabel={name}
            subtitle={isSelf ? t("members.you") : undefined}
            testID={`household-member-${user.id}`}
            title={name}
            value={user.isAdmin ? t("info.admin") : t("info.member")}
          />
        );
      })}
    </SettingsGroup>
  );
}
