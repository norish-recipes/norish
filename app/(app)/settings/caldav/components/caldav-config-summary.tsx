"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader, Chip, Switch, Button, useDisclosure } from "@heroui/react";
import {
  ServerIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

import { useCalDavSettingsContext } from "../context";

import DeleteCalDavModal from "./delete-caldav-modal";

interface CalDavConfigSummaryProps {
  onEditClick: () => void;
}

export default function CalDavConfigSummary({ onEditClick }: CalDavConfigSummaryProps) {
  const {
    config,
    syncStatusSummary: _syncStatusSummary,
    checkConnectionStatus,
    saveConfig,
    syncStatuses,
    deleteConfig,
  } = useCalDavSettingsContext();

  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

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
      password: "", // Don't change password
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
        return "Connected";
      case "checking":
        return "Checking...";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex items-start justify-between pb-2">
          <div className="flex flex-1 items-center gap-3">
            <ServerIcon className="text-primary h-6 w-6" />
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">CalDAV Configuration</h2>
              <Chip
                color={getConnectionStatusColor()}
                size="sm"
                startContent={
                  connectionStatus === "checking" ? (
                    <ArrowPathIcon className="h-3 w-3 animate-spin" />
                  ) : connectionStatus === "connected" ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <XCircleIcon className="h-3 w-3" />
                  )
                }
                variant="flat"
              >
                {getConnectionStatusText()}
              </Chip>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              startContent={<PencilIcon className="h-4 w-4" />}
              variant="flat"
              onPress={onEditClick}
            >
              Edit
            </Button>
            <Button
              color="danger"
              size="sm"
              startContent={<TrashIcon className="h-4 w-4" />}
              variant="flat"
              onPress={onDeleteOpen}
            >
              Delete
            </Button>
          </div>
        </CardHeader>

        <CardBody className="gap-4">
          {/* Server URL and Enabled Toggle */}
          <div className="bg-default-100 flex flex-col justify-between gap-4 rounded-lg p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-default-700 mb-1 text-base font-medium">Server URL</p>
              <p className="text-default-500 truncate text-xs">{config.serverUrl}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-default-600 text-base">
                {config.enabled ? "Enabled" : "Disabled"}
              </span>
              <Switch isSelected={config.enabled} size="sm" onValueChange={handleToggleEnabled} />
            </div>
          </div>
        </CardBody>
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
