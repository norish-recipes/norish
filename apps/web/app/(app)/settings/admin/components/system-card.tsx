"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Label, TextField, useOverlayState } from "@heroui/react";
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
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cog6ToothIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-6">
        {/* Scheduler Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-medium">
            {t("cleanup.title")}
            {hasSchedulerChanges && <UnsavedChangesChip />}
          </h3>
          <TextField
            className="max-w-xs"
            type="number"
            value={months.toString()}
            onChange={(value) => setMonths(parseInt(value) || 3)}
          >
            <Label>{t("cleanup.label")}</Label>
            <Input variant="secondary" max={24} min={1} />
          </TextField>
          <p className="text-muted text-xs">{t("cleanup.description")}</p>
          <div className="flex justify-end">
            <Button
              isDisabled={!hasSchedulerChanges}
              onPress={handleSaveScheduler}
              variant="primary"
              isPending={saving}
            >
              {<CheckIcon className="h-5 w-5" />}
              {tActions("save")}
            </Button>
          </div>
        </div>

        {/* Server Restart */}
        <div className="border-divider flex flex-col gap-4 border-t pt-4">
          <h3 className="font-medium">{t("server.title")}</h3>
          <div className="flex flex-col gap-2">
            <span className="text-base">{t("server.restartLabel")}</span>
            <p className="text-muted text-xs">{t("server.restartDescription")}</p>
            <div className="flex justify-end">
              <Button onPress={restartModal.open} variant="tertiary">
                {<ArrowPathIcon className="h-5 w-5" />}
                {t("server.restartButton")}
              </Button>
            </div>
          </div>
        </div>
      </Card.Content>

      <RestartConfirmationModal
        isOpen={restartModal.isOpen}
        onClose={restartModal.close}
        onConfirm={handleRestart}
      />
    </Card>
  );
}
