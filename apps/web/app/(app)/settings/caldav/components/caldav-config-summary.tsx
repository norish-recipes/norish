"use client";

import { useCallback, useEffect, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  PencilIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";
import { Button, Card, Chip, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCalDavSettingsContext } from "../context";
import DeleteCalDavModal from "./delete-caldav-modal";

interface CalDavConfigSummaryProps {
  onEditClick: () => void;
}
export default function CalDavConfigSummary({ onEditClick }: CalDavConfigSummaryProps) {
  const t = useTranslations("settings.caldav.config");
  const {
    config,
    syncStatusSummary: _syncStatusSummary,
    checkConnectionStatus,
    saveConfig,
    syncStatuses,
    deleteConfig,
  } = useCalDavSettingsContext();
  const { isOpen: isDeleteOpen, open: onDeleteOpen, close: onDeleteClose } = useOverlayState();
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const [pollingInterval, setPollingInterval] = useState(60000); // Start with 60s
  const [_lastCheck, setLastCheck] = useState<Date | null>(null);

  // Check connection status
  const checkConnection = useCallback(async () => {
    if (!config) return;
    setConnectionStatus("checking");
    try {
      const result = await checkConnectionStatus();
      setConnectionStatus(result.success ? "connected" : "disconnected");
      setLastCheck(new Date());

      // Reset interval to 60s on success, use exponential backoff on failure
      if (result.success) {
        setPollingInterval(60000);
      } else {
        setPollingInterval((prev) => Math.min(prev * 2, 300000)); // Max 5 minutes
      }
    } catch (_error) {
      setConnectionStatus("disconnected");
      setPollingInterval((prev) => Math.min(prev * 2, 300000));
    }
  }, [config, checkConnectionStatus]);

  // Initial check and polling setup
  useEffect(() => {
    if (!config) return;

    // Check immediately
    checkConnection();

    // Set up polling
    const intervalId = setInterval(checkConnection, pollingInterval);
    return () => clearInterval(intervalId);
  }, [config, pollingInterval, checkConnection]);
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!config) return;
    await saveConfig({
      serverUrl: config.serverUrl,
      username: config.username,
      password: "",
      // Don't change password
      enabled,
      breakfastTime: config.breakfastTime,
      lunchTime: config.lunchTime,
      dinnerTime: config.dinnerTime,
      snackTime: config.snackTime,
    });
  };
  if (!config) return null;

  // Find most recent sync timestamp
  const _mostRecentSync = syncStatuses.reduce(
    (latest, status) => {
      if (!status.lastSyncAt) return latest;
      const syncDate = new Date(status.lastSyncAt);
      return !latest || syncDate > latest ? syncDate : latest;
    },
    null as Date | null
  );
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "success";
      case "checking":
        return "warning";
      case "disconnected":
        return "danger";
      default:
        return "default";
    }
  };
  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case "connected":
        return t("connectionStatus.connected");
      case "checking":
        return t("connectionStatus.checking");
      case "disconnected":
        return t("connectionStatus.disconnected");
      default:
        return t("connectionStatus.unknown");
    }
  };
  return (
    <>
      <Card>
        <Card.Header className="flex items-start justify-between pb-2">
          <div className="flex flex-1 items-center gap-3">
            <ServerIcon className="text-accent h-6 w-6" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">{t("title")}</h2>
              <Chip color={getConnectionStatusColor()} size="sm" variant="soft">
                {connectionStatus === "checking" ? (
                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                ) : connectionStatus === "connected" ? (
                  <CheckCircleIcon className="h-3 w-3" />
                ) : (
                  <XCircleIcon className="h-3 w-3" />
                )}
                <Chip.Label>{getConnectionStatusText()}</Chip.Label>
              </Chip>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onPress={onEditClick} variant="tertiary" className="min-w-16">
              {<PencilIcon className="h-4 w-4" />}
              {t("editButton")}
            </Button>
            <Button size="sm" onPress={onDeleteOpen} variant="danger-soft" className="min-w-16">
              {<TrashIcon className="h-4 w-4" />}
              {t("deleteButton")}
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="gap-4">
          {/* Server URL and Enabled Toggle */}
          <div className="bg-surface-secondary flex flex-col justify-between gap-4 rounded-lg p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-foreground mb-1 text-base font-medium">{t("serverUrl")}</p>
              <p className="text-muted truncate text-xs">{config.serverUrl}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted text-base">
                {config.enabled ? t("enabled") : t("disabled")}
              </span>
              <SettingsSwitch
                isSelected={config.enabled}
                size="sm"
                onValueChange={handleToggleEnabled}
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      <DeleteCalDavModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={async (deleteEvents) => {
          await deleteConfig(deleteEvents);
          onDeleteClose();
        }}
      />
    </>
  );
}
