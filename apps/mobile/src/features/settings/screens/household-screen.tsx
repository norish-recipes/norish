import React from "react";
import { useText } from "@/lib/i18n/use-text";

import {
  adminViewOf,
  leaveWarns,
  useHousehold,
  useHouseholdCacheHelpers,
  useHouseholdMutations,
} from "@norish/shared-react/reader";

import { JoinCodeCard } from "../components/join-code-card";
import { MembersList } from "../components/members-list";
import { NoHouseholdForms } from "../components/no-household-forms";
import { ReadBody } from "../components/read-body";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { useConfirmedWrite } from "../hooks/use-confirmed-write";
import { readState } from "../utils/read-state";

/** Household: the members, join code and Leave, or create-or-join when the Reader has none. Being
 * kicked or leaving empties the cached household, which lands here as the no-household state. */
export function HouseholdScreen() {
  const text = useText();
  const confirmedWrite = useConfirmedWrite();
  const { household, currentUserId, isAdmin, isLoading, error } = useHousehold();
  const { invalidate } = useHouseholdCacheHelpers();
  const { leaveHousehold } = useHouseholdMutations();
  // currentUserId comes with every answer, so it marks a read that succeeded.
  const page = readState({
    held: household !== null,
    answered: currentUserId !== undefined,
    isLoading,
    error,
  });
  const admin = adminViewOf(household, currentUserId);

  const confirmLeave = (held: NonNullable<typeof household>) => {
    const warning = leaveWarns({ isAdmin, otherMemberCount: held.users.length - 1 })
      ? `\n\n${text("settings.household.info.leaveModal.adminWarning")}`
      : "";

    return confirmedWrite({
      title: text("settings.household.info.leaveModal.title"),
      message: `${text("settings.household.info.leaveModal.confirmMessage", { name: held.name })}${warning}`,
      confirmLabelId: "settings.household.info.leaveModal.confirmButton",
      send: () => leaveHousehold(held.id),
      key: "leave",
    });
  };

  return (
    <SettingsPage testID="settings-household-screen" title={text("settings.tabs.household")}>
      <ReadBody
        empty={<NoHouseholdForms />}
        name="settings-household"
        state={page}
        onRetry={invalidate}
      >
        {household ? (
          <>
            <SettingsGroup className="pt-1">
              <SettingsRow
                icon="home-outline"
                testID="settings-household-name"
                title={household.name}
                value={
                  isAdmin
                    ? text("settings.household.info.admin")
                    : text("settings.household.info.member")
                }
              />
            </SettingsGroup>
            <MembersList currentUserId={currentUserId} household={household} isAdmin={isAdmin} />
            {admin ? <JoinCodeCard household={admin} /> : null}
            <SettingsGroup className="pt-[30px]">
              <SettingsRow
                centred
                danger
                write
                icon="log-out-outline"
                testID="settings-household-leave"
                title={text("settings.household.info.leaveButton")}
                onPress={confirmLeave(household)}
              />
            </SettingsGroup>
          </>
        ) : null}
      </ReadBody>
    </SettingsPage>
  );
}
