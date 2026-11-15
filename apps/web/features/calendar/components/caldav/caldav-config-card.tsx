"use client";

import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { ServerIcon } from "@heroicons/react/24/outline";
import { Link, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCaldavConfigQuery, useCaldavMutations } from "@norish/shared-react/calendar";

import CaldavConfigEditModal from "./caldav-config-edit-modal";
import CaldavConfigSummary from "./caldav-config-summary";
import { CaldavFormFields, useCaldavForm } from "./caldav-form";

export default function CaldavConfigCard() {
  const { config: configured } = useCaldavConfigQuery((config) => config !== null);
  const {
    isOpen: isEditModalOpen,
    open: onEditModalOpen,
    close: onEditModalClose,
  } = useOverlayState();

  if (!configured) return <CaldavSetupCard />;

  return (
    <>
      <CaldavConfigSummary onEditClick={onEditModalOpen} />
      <CaldavConfigEditModal isOpen={isEditModalOpen} onClose={onEditModalClose} />
    </>
  );
}

function CaldavSetupCard() {
  const t = useTranslations("settings.caldav.setup");
  const tActions = useTranslations("common.actions");
  const { saveConfig, isSavingConfig: saving } = useCaldavMutations();
  const form = useCaldavForm(null);
  const { serverUrl, username, password, calendarUrl, connection } = form;
  const canSave = serverUrl && username && password && calendarUrl && form.timesValid;

  const handleSave = () => {
    connection.setTestResult(null);
    void saveConfig(form.toSave(true));
  };

  return (
    <SettingsCard description={t("description")} icon={ServerIcon} title={t("title")}>
      <Note status="accent" title={t("gettingStarted")}>
        <p className="mb-2">{t("providerDescription")}</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            <Link
              href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html"
              rel="noopener noreferrer"
              target="_blank"
            >
              Nextcloud Calendar
            </Link>
          </li>
          <li>
            <Link href="https://radicale.org/" rel="noopener noreferrer" target="_blank">
              Radicale
            </Link>
          </li>
          <li>
            <Link
              href="https://support.apple.com/guide/calendar/set-up-accounts-icl4308d6701/mac"
              rel="noopener noreferrer"
              target="_blank"
            >
              Apple Calendar
            </Link>
          </li>
          {/* No Google Calendar here: its CalDAV endpoint now requires
                OAuth/OIDC, which this username/password setup cannot do. */}
        </ul>
      </Note>

      <CaldavFormFields
        form={form}
        isConfigured={false}
        onTrust={() => connection.trustAndRetest(form.target(password))}
      />

      <ActionButtonGroup>
        <ActionButton
          action="test"
          isDisabled={!serverUrl || !username || !password}
          isPending={connection.testing}
          onPress={() => connection.runTest(form.target(password))}
        >
          {tActions("test")}
        </ActionButton>
        <ActionButton action="save" isDisabled={!canSave} isPending={saving} onPress={handleSave}>
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </SettingsCard>
  );
}
