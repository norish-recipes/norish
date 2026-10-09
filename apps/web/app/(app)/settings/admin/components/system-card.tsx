"use client";

import { useEffect, useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { Button, Input, Separator, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";
import RestartConfirmationModal from "./restart-confirmation-modal";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function SystemCard() {
  const t = useTranslations("settings.admin.system");
  const tActions = useTranslations("common.actions");
  const { schedulerCleanupMonths, updateSchedulerMonths, restartServer } =
    useAdminSettingsContext();
  const [months, setMonths] = useState(schedulerCleanupMonths ?? 3);
  const [saving, setSaving] = useState(false);
  const restartModal = useOverlayState();
  const hasSchedulerChanges =
    schedulerCleanupMonths !== undefined && months !== schedulerCleanupMonths;

  useEffect(() => {
    if (schedulerCleanupMonths !== undefined) {
      setMonths(schedulerCleanupMonths);
    }
  }, [schedulerCleanupMonths]);
  const handleSaveScheduler = async () => {
    setSaving(true);
    try {
      await updateSchedulerMonths(months);
    } finally {
      setSaving(false);
    }
  };
  const handleRestart = async () => {
    await restartServer();
    restartModal.close();
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
      <div className="flex justify-end">
        <Button
          isDisabled={!hasSchedulerChanges}
          isPending={saving}
          variant="primary"
          onPress={handleSaveScheduler}
        >
          {tActions("save")}
        </Button>
      </div>

      <Separator />

      <SettingRow description={t("server.restartDescription")} title={t("server.restartLabel")}>
        <Button variant="tertiary" onPress={restartModal.open}>
          <ArrowPathIcon className="h-5 w-5" />
          {t("server.restartButton")}
        </Button>
      </SettingRow>

      <RestartConfirmationModal
        isOpen={restartModal.isOpen}
        onClose={restartModal.close}
        onConfirm={handleRestart}
      />
    </SettingsCard>
  );
}
