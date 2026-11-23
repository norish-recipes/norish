import React from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useIntl } from "react-intl";

import { useHousehold, useHouseholdMutations } from "@norish/shared-react/reader";

import { JoinCodeCard } from "../components/join-code-card";
import { MembersList } from "../components/members-list";
import { NoHouseholdForms } from "../components/no-household-forms";
import { SettingsGroup } from "../components/settings-group";
import { SettingsPage } from "../components/settings-page";
import { SettingsRow } from "../components/settings-row";
import { useSettingsWrite } from "../hooks/use-settings-write";
import { adminViewOf, householdState, leaveWarns } from "../utils/household-rules";

/** Household: the members, join code and Leave, or create-or-join when the Reader has none. Being
 * kicked or leaving empties the cached household, which lands here as the no-household state. */
export function HouseholdScreen() {
  const intl = useIntl();
  const confirm = useConfirm();
  const { household, currentUserId, isAdmin, isLoading } = useHousehold();
  const { leaveHousehold } = useHouseholdMutations();
  const write = useSettingsWrite();
  const state = householdState(household, isAdmin);
  const t = (id: string, values?: Record<string, string>) =>
    intl.formatMessage({ id: `settings.household.${id}` }, values);
  const admin = household && isAdmin ? adminViewOf(household) : null;

  const confirmLeave = () => {
    if (!household) return;

    const warning = leaveWarns(isAdmin, household.users.length)
      ? `\n\n${t("info.leaveModal.adminWarning")}`
      : "";

    confirm({
      title: t("info.leaveModal.title"),
      message: `${t("info.leaveModal.confirmMessage", { name: household.name })}${warning}`,
      confirmLabelId: "settings.household.info.leaveModal.confirmButton",
      onConfirm: write(() => leaveHousehold(household.id)),
    });
  };

  return (
    <SettingsPage
      testID="settings-household-screen"
      title={intl.formatMessage({ id: "settings.tabs.household" })}
    >
      {household ? (
        <>
          <SettingsGroup className="pt-1">
            <SettingsRow
              icon="home-outline"
              testID="household-name"
              title={household.name}
              value={state === "admin" ? t("info.admin") : t("info.member")}
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
              title={t("info.leaveButton")}
              onPress={confirmLeave}
            />
          </SettingsGroup>
        </>
      ) : isLoading ? null : (
        <NoHouseholdForms />
      )}
    </SettingsPage>
  );
}
