import React from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useText } from "@/lib/i18n/use-text";

import {
  adminViewOf,
  leaveWarns,
  useHousehold,
  useHouseholdCacheHelpers,
  useHouseholdMutations,
} from "@norish/shared-react/reader";

import { FailedLoad } from "../components/failed-load";
import { JoinCodeCard } from "../components/join-code-card";
import { MembersList } from "../components/members-list";
import { NoHouseholdForms } from "../components/no-household-forms";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { readState } from "../utils/read-state";
import { settingsWrite } from "../utils/settings-write";

/** Household: the members, join code and Leave, or create-or-join when the Reader has none. Being
 * kicked or leaving empties the cached household, which lands here as the no-household state. */
export function HouseholdScreen() {
  const text = useText();
  const confirm = useConfirm();
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

  const confirmLeave = () => {
    if (!household) return;

    const warning = leaveWarns({ isAdmin, otherMemberCount: household.users.length - 1 })
      ? `\n\n${text("settings.household.info.leaveModal.adminWarning")}`
      : "";

    confirm({
      title: text("settings.household.info.leaveModal.title"),
      message: `${text("settings.household.info.leaveModal.confirmMessage", { name: household.name })}${warning}`,
      confirmLabelId: "settings.household.info.leaveModal.confirmButton",
      onConfirm: settingsWrite(() => leaveHousehold(household.id), "leave"),
    });
  };

  return (
    <SettingsPage testID="settings-household-screen" title={text("settings.tabs.household")}>
      {page === "held" && household ? (
        <>
          <SettingsGroup className="pt-1">
            <SettingsRow
              icon="home-outline"
              testID="household-name"
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
              testID="household-leave"
              title={text("settings.household.info.leaveButton")}
              onPress={confirmLeave}
            />
          </SettingsGroup>
        </>
      ) : page === "failed" ? (
        <FailedLoad name="household" onRetry={invalidate} />
      ) : page === "empty" ? (
        <NoHouseholdForms />
      ) : null}
    </SettingsPage>
  );
}
