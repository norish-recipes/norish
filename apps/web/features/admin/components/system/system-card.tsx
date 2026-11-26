"use client";

import { useState } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { usePending } from "@/hooks/use-pending";
import { ArrowPathIcon, KeyIcon } from "@heroicons/react/16/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { Input, Separator, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useMasterKeyPinned,
  useRestartServerMutation,
  useRotateMasterKeyMutation,
  useSchedulerMonthsMutation,
} from "@norish/shared-react/admin";

import { UnsavedChangesChip } from "../unsaved-changes-chip";
import RestartConfirmationModal from "./restart-confirmation-modal";

export default function SystemCard() {
  const t = useTranslations("settings.admin.system");
  const tActions = useTranslations("common.actions");
  const tRestart = useTranslations("settings.admin.restart");
  const tRotate = useTranslations("settings.admin.rotateMasterKey");
  const schedulerCleanupMonths = useAdminConfig(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS);
  const saveSchedulerMonths = useSchedulerMonthsMutation();
  const restartServer = useRestartServerMutation();
  const masterKeyPinned = useMasterKeyPinned();
  const rotateMasterKey = useRotateMasterKeyMutation();
  const [months, setMonths] = useState(schedulerCleanupMonths ?? 3);
  const [saving, whileSaving] = usePending();
  const restartModal = useOverlayState();
  const rotateModal = useOverlayState();
  const hasSchedulerChanges =
    schedulerCleanupMonths !== undefined && months !== schedulerCleanupMonths;

  const [prevSchedulerCleanupMonths, setPrevSchedulerCleanupMonths] =
    useState(schedulerCleanupMonths);

  if (schedulerCleanupMonths !== prevSchedulerCleanupMonths) {
    setPrevSchedulerCleanupMonths(schedulerCleanupMonths);
    if (schedulerCleanupMonths !== undefined) {
      setMonths(schedulerCleanupMonths);
    }
  }
  const handleSaveScheduler = async () => {
    await whileSaving(() => saveSchedulerMonths(months));
  };
  const handleRestart = async () => {
    if (await restartServer()) restartModal.close();
  };
  // The server restarts once it answers; its new key ends this session, so the page signs out.
  const handleRotate = async () => {
    if (await rotateMasterKey()) rotateModal.close();
  };

  return (
    <SettingsCard contentClassName="gap-6" icon={WrenchScrewdriverIcon} title={t("title")}>
      <SettingRow
        badges={hasSchedulerChanges ? <UnsavedChangesChip /> : null}
        description={t("cleanup.description")}
        title={t("cleanup.label")}
      >
        <TextField
          aria-label={t("cleanup.label")}
          className="w-full"
          type="number"
          value={months.toString()}
          onChange={(value) => setMonths(parseInt(value) || 3)}
        >
          <Input max={24} min={1} variant="secondary" />
        </TextField>
      </SettingRow>
      <ActionButtonGroup>
        <ActionButton
          action="save"
          isDisabled={!hasSchedulerChanges}
          isPending={saving}
          onPress={handleSaveScheduler}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>

      <Separator />

      <SettingRow description={t("server.restartDescription")} title={t("server.restartLabel")}>
        <ActionButton
          fullWidth
          action="apply"
          icon={ArrowPathIcon}
          variant="tertiary"
          onPress={restartModal.open}
        >
          {t("server.restartButton")}
        </ActionButton>
      </SettingRow>

      {masterKeyPinned === true ? (
        <Note title={t("masterKey.label")}>
          {t.rich("masterKey.pinned", {
            code: (chunks) => <code className="bg-default rounded px-1">{chunks}</code>,
          })}
        </Note>
      ) : null}
      {masterKeyPinned === false ? (
        <SettingRow description={t("masterKey.description")} title={t("masterKey.label")}>
          <ActionButton
            fullWidth
            action="apply"
            icon={KeyIcon}
            variant="tertiary"
            onPress={rotateModal.open}
          >
            {t("masterKey.button")}
          </ActionButton>
        </SettingRow>
      ) : null}

      <RestartConfirmationModal
        confirmLabel={tRestart("confirmButton")}
        icon={ArrowPathIcon}
        isOpen={restartModal.isOpen}
        message={tRestart("confirmMessage")}
        title={tRestart("title")}
        warnings={[tRestart("warning1"), tRestart("warning2")]}
        onClose={restartModal.close}
        onConfirm={handleRestart}
      />
      <RestartConfirmationModal
        confirmLabel={tRotate("confirmButton")}
        icon={KeyIcon}
        isOpen={rotateModal.isOpen}
        message={tRotate("confirmMessage")}
        title={tRotate("title")}
        warnings={[tRotate("sessions"), tRotate("shareLinks")]}
        onClose={rotateModal.close}
        onConfirm={handleRotate}
      />
    </SettingsCard>
  );
}
