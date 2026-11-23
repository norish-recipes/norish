import React from "react";
import { UserAvatar } from "@/components/user-avatar";
import { useText } from "@/lib/i18n/use-text";

import type { HouseholdSettingsDto } from "@norish/shared/contracts/dto/household";
import { allowedMemberActions, useHouseholdMutations } from "@norish/shared-react/reader";

import { useConfirmedWrite } from "../hooks/use-confirmed-write";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

const KICK = {
  kind: "kick",
  button: "settings.household.members.kickButton",
  title: "settings.household.members.kickModal.title",
  message: "settings.household.members.kickModal.confirmMessage",
  warning: "settings.household.members.kickModal.warning",
  confirm: "settings.household.members.kickModal.confirmButton",
  destructive: true,
} as const;

const MAKE_ADMIN = {
  kind: "admin",
  button: "settings.household.members.makeAdminButton",
  title: "settings.household.members.transferModal.title",
  message: "settings.household.members.transferModal.confirmMessage",
  warning: "settings.household.members.transferModal.warning",
  confirm: "settings.household.members.transferModal.confirmButton",
  destructive: false,
} as const;

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
  const text = useText();
  const confirmedWrite = useConfirmedWrite();
  const { kickUser, transferAdmin } = useHouseholdMutations();
  const send = {
    kick: (userId: string) => kickUser(household.id, userId),
    transferAdmin: (userId: string) => transferAdmin(household.id, userId),
  };
  const looks = { kick: KICK, transferAdmin: MAKE_ADMIN };

  return (
    <SettingsGroup title={text("settings.household.members.title")}>
      {household.users.map((user) => {
        const isSelf = user.id === currentUserId;
        const name = user.name || text("settings.household.members.unknown");
        const actions = allowedMemberActions({
          viewerIsAdmin: isAdmin,
          isSelf,
          memberIsAdmin: user.isAdmin === true,
        }).map((action) => {
          const look = looks[action];

          return {
            kind: look.kind,
            label: text(look.button),
            onPress: confirmedWrite({
              title: text(look.title),
              message: `${text(look.message, { name })}\n\n${text(look.warning)}`,
              confirmLabelId: look.confirm,
              destructive: look.destructive,
              send: () => send[action](user.id),
              key: `${action}:${user.id}`,
            }),
          };
        });

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
            subtitle={isSelf ? text("settings.household.members.you") : undefined}
            testID={`household-member-${user.id}`}
            title={name}
            value={text(
              user.isAdmin ? "settings.household.info.admin" : "settings.household.info.member"
            )}
          />
        );
      })}
    </SettingsGroup>
  );
}
