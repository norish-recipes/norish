"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, useDisclosure } from "@heroui/react";
import { Cog6ToothIcon, ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import RestartConfirmationModal from "./restart-confirmation-modal";

export default function SystemCard() {
  const { schedulerCleanupMonths, updateSchedulerMonths, restartServer } =
    useAdminSettingsContext();

  const [months, setMonths] = useState(schedulerCleanupMonths ?? 3);
  const [saving, setSaving] = useState(false);
  const restartModal = useDisclosure();

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
          System Settings
        </h2>
      </CardHeader>
      <CardBody className="gap-6">
        {/* Scheduler Settings */}
        <div className="flex flex-col gap-4">
          <h3 className="font-medium">Cleanup Scheduler</h3>
          <Input
            className="max-w-xs"
            label="Cleanup Months"
            max={24}
            min={1}
            type="number"
            value={months.toString()}
            onValueChange={(v) => setMonths(parseInt(v) || 3)}
          />
          <p className="text-default-500 text-xs">
            Delete planned meals older than this many months
          </p>
          <div className="flex justify-end">
            <Button
              color="primary"
              isLoading={saving}
              startContent={<CheckIcon className="h-5 w-5" />}
              onPress={handleSaveScheduler}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Server Restart */}
        <div className="border-divider flex flex-col gap-4 border-t pt-4">
          <h3 className="font-medium">Server Management</h3>
          <div className="flex flex-col gap-2">
            <span className="text-base">Restart Server</span>
            <p className="text-default-500 text-xs">
              Apply configuration changes that require a restart
            </p>
            <div className="flex justify-end">
              <Button
                color="warning"
                startContent={<ArrowPathIcon className="h-5 w-5" />}
                variant="flat"
                onPress={restartModal.onOpen}
              >
                Restart Server
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
