"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, useDisclosure } from "@heroui/react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
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
  const restartModal = useDisclosure();
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
    restartModal.onClose();
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cog6ToothIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-6">
        {/* Scheduler Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="flex items-center gap-2 font-medium">
            {t("cleanup.title")}
            {hasSchedulerChanges && <UnsavedChangesChip />}
          </h3>
          <Input
            className="max-w-xs"
            label={t("cleanup.label")}
            max={24}
            min={1}
            type="number"
            value={months.toString()}
            onValueChange={(v) => setMonths(parseInt(v) || 3)}
          />
          <p className="text-default-500 text-xs">{t("cleanup.description")}</p>
          <div className="flex justify-end">
            <Button
              color="primary"
              isDisabled={!hasSchedulerChanges}
              isLoading={saving}
              startContent={<CheckIcon className="h-5 w-5" />}
              onPress={handleSaveScheduler}
            >
              {tActions("save")}
            </Button>
          </div>
        </div>

        {/* Server Restart */}
        <div className="border-divider flex flex-col gap-4 border-t pt-4">
          <h3 className="font-medium">{t("server.title")}</h3>
          <div className="flex flex-col gap-2">
            <span className="text-base">{t("server.restartLabel")}</span>
            <p className="text-default-500 text-xs">{t("server.restartDescription")}</p>
            <div className="flex justify-end">
              <Button
                color="warning"
                startContent={<ArrowPathIcon className="h-5 w-5" />}
                variant="flat"
                onPress={restartModal.onOpen}
              >
                {t("server.restartButton")}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>

      <RestartConfirmationModal
        isOpen={restartModal.isOpen}
        onClose={restartModal.onClose}
        onConfirm={handleRestart}
      />
    </Card>
  );
}
