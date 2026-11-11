"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton } from "@/components/shared/action-button";
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";
import { Chip, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  useCaldavConfigQuery,
  useCaldavConnectionQuery,
  useCaldavMutations,
} from "@norish/shared-react/calendar";

import DeleteCaldavModal from "./delete-caldav-modal";

interface CaldavConfigSummaryProps {
  onEditClick: () => void;
}
export default function CaldavConfigSummary({ onEditClick }: CaldavConfigSummaryProps) {
  const t = useTranslations("settings.caldav.config");
  const { config } = useCaldavConfigQuery();
  const { saveConfig, deleteConfig } = useCaldavMutations();
  const {
    isConnected,
    message: connectionMessage,
    invalidate: recheckConnection,
  } = useCaldavConnectionQuery();
  const { isOpen: isDeleteOpen, open: onDeleteOpen, close: onDeleteClose } = useOverlayState();
  const [connectionStatus, setConnectionStatus] = useState<
    "checking" | "connected" | "disconnected"
  >("checking");
  const [pollingInterval, setPollingInterval] = useState(60000);

  const checkConnection = useCallback(async () => {
    if (!config) return;
    setConnectionStatus("checking");
    recheckConnection();
    const result = { success: isConnected, message: connectionMessage };

    setConnectionStatus(result.success ? "connected" : "disconnected");
    if (result.success) {
      setPollingInterval(60000);
    } else {
      setPollingInterval((prev) => Math.min(prev * 2, 300000));
    }
  }, [config, recheckConnection, isConnected, connectionMessage]);

  useEffect(() => {
    if (!config) return;
    checkConnection();
    const intervalId = setInterval(checkConnection, pollingInterval);

    return () => clearInterval(intervalId);
  }, [config, pollingInterval, checkConnection]);
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!config) return;
    await saveConfig({
      serverUrl: config.serverUrl,
      username: config.username,
      // Empty keeps the stored password.
      password: "",
      enabled,
      breakfastTime: config.breakfastTime,
      lunchTime: config.lunchTime,
      dinnerTime: config.dinnerTime,
      snackTime: config.snackTime,
    });
  };

  if (!config) return null;

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
      <SettingsCard
        actions={
          <>
            <ActionButton action="edit" size="sm" onPress={onEditClick}>
              {t("editButton")}
            </ActionButton>
            <ActionButton action="delete" size="sm" onPress={onDeleteOpen}>
              {t("deleteButton")}
            </ActionButton>
          </>
        }
        badges={
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
        }
        icon={ServerIcon}
        title={t("title")}
      >
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
      </SettingsCard>

      <DeleteCaldavModal isOpen={isDeleteOpen} onClose={onDeleteClose} onConfirm={deleteConfig} />
    </>
  );
}
