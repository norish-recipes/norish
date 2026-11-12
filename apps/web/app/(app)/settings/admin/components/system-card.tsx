"use client";

import { useState } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { Input, Separator, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useRestartServer,
  useSchedulerMonthsWrite,
} from "@norish/shared-react/admin";

import RestartConfirmationModal from "./restart-confirmation-modal";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function SystemCard() {
  const t = useTranslations("settings.admin.system");
  const tActions = useTranslations("common.actions");
  const schedulerCleanupMonths = useAdminConfig(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS);
  const saveSchedulerMonths = useSchedulerMonthsWrite();
  const restartServer = useRestartServer();
  const [months, setMonths] = useState(schedulerCleanupMonths ?? 3);
  const [saving, whileSaving] = usePending();
  const restartModal = useOverlayState();
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

      <RestartConfirmationModal
        isOpen={restartModal.isOpen}
        onClose={restartModal.close}
        onConfirm={handleRestart}
      />
    </SettingsCard>
  );
}
