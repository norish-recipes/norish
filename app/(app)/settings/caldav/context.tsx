"use client";

import type { CaldavSyncStatus } from "@/types/dto/caldav-sync-status";
import type { UserCaldavConfigWithoutPasswordDto } from "@/types";

import { createContext, useContext, ReactNode, useCallback, useState } from "react";
import { addToast } from "@heroui/react";

import {
  useCaldavConfigQuery,
  useCaldavPasswordQuery,
  useCaldavSyncStatusQuery,
  useCaldavSummaryQuery,
  useCaldavConnectionQuery,
  useCaldavMutations,
  useCaldavSubscription,
} from "@/hooks/caldav";

type SaveCaldavConfigInput = {
  serverUrl: string;
  username: string;
  password: string;
  enabled: boolean;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  snackTime: string;
};

type CalDavSettingsContextType = {
  config: UserCaldavConfigWithoutPasswordDto | null;
  isLoading: boolean;

  // Sync status
  syncStatuses: any[];
  syncStatusPage: number;
  syncStatusTotal: number;
  syncStatusSummary: { pending: number; synced: number; failed: number; removed: number };
  setSyncStatusPage: (page: number) => void;
  syncStatusFilter: CaldavSyncStatus | undefined;
  setSyncStatusFilter: (filter: CaldavSyncStatus | undefined) => void;

  // Connection status
  isConnected: boolean;
  connectionMessage: string;
  isCheckingConnection: boolean;

  // Actions
  saveConfig: (config: SaveCaldavConfigInput) => Promise<void>;
  testConnection: (
    serverUrl: string,
    username: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  deleteConfig: (deleteEvents: boolean) => Promise<void>;
  triggerManualSync: () => Promise<void>;
  syncAll: () => Promise<void>;
  checkConnectionStatus: () => Promise<{ success: boolean; message: string }>;
  getCaldavPassword: () => Promise<string | null>;

  // Loading states
  isSavingConfig: boolean;
  isTestingConnection: boolean;
  isDeletingConfig: boolean;
  isTriggeringSync: boolean;
};

const CalDavSettingsContext = createContext<CalDavSettingsContextType | null>(null);

export function CalDavSettingsProvider({ children }: { children: ReactNode }) {
  // Queries
  const { config, isLoading: isLoadingConfig, setConfig: _setConfig } = useCaldavConfigQuery();
  const { password: storedPassword, isLoading: _isLoadingPassword } = useCaldavPasswordQuery();
  const [syncStatusPage, setSyncStatusPage] = useState(1);
  const [syncStatusFilter, setSyncStatusFilter] = useState<CaldavSyncStatus | undefined>("pending");

  const {
    statuses: syncStatuses,
    total: syncStatusTotal,
    isLoading: isLoadingSyncStatus,
  } = useCaldavSyncStatusQuery(syncStatusPage, 20, syncStatusFilter);

  const { summary: syncStatusSummary } = useCaldavSummaryQuery();

  const {
    isConnected,
    message: connectionMessage,
    isLoading: isCheckingConnection,
    invalidate: recheckConnection,
  } = useCaldavConnectionQuery();

  // Mutations
  const {
    saveConfig: saveConfigMutation,
    testConnection: testConnectionMutation,
    deleteConfig: deleteConfigMutation,
    triggerSync,
    syncAll: syncAllMutation,
    isSavingConfig,
    isTestingConnection,
    isDeletingConfig,
    isTriggeringSync,
    isSyncingAll: _isSyncingAll,
  } = useCaldavMutations();

  // Subscribe to real-time updates
  useCaldavSubscription();

  const saveConfig = useCallback(
    async (configInput: SaveCaldavConfigInput) => {
      try {
        await saveConfigMutation(configInput);
        addToast({
          title: "Configuration saved",
          description: "Your CalDAV settings have been saved successfully.",
          color: "success",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      } catch (error) {
        addToast({
          title: "Failed to save configuration",
          description: (error as Error).message,
          color: "danger",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        throw error;
      }
    },
    [saveConfigMutation]
  );

  const testConnection = useCallback(
    async (
      serverUrl: string,
      username: string,
      password: string
    ): Promise<{ success: boolean; message: string }> => {
      try {
        return await testConnectionMutation({ serverUrl, username, password });
      } catch (error) {
        return {
          success: false,
          message: (error as Error).message,
        };
      }
    },
    [testConnectionMutation]
  );

  const deleteConfig = useCallback(
    async (deleteEvents: boolean) => {
      try {
        await deleteConfigMutation(deleteEvents);
        addToast({
          title: "Configuration deleted",
          description: "Your CalDAV settings have been removed.",
          color: "success",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      } catch (error) {
        addToast({
          title: "Failed to delete configuration",
          description: (error as Error).message,
          color: "danger",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        throw error;
      }
    },
    [deleteConfigMutation]
  );

  const triggerManualSync = useCallback(async () => {
    try {
      await triggerSync();
      addToast({
        title: "Sync started",
        description: "Retrying pending and failed items...",
        color: "primary",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (error) {
      addToast({
        title: "Failed to trigger sync",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
      throw error;
    }
  }, [triggerSync]);

  const syncAll = useCallback(async () => {
    try {
      await syncAllMutation();
      addToast({
        title: "Full sync started",
        description: "Syncing all future items to CalDAV...",
        color: "primary",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } catch (error) {
      addToast({
        title: "Failed to start sync",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
      throw error;
    }
  }, [syncAllMutation]);

  const checkConnectionStatus = useCallback(async (): Promise<{
    success: boolean;
    message: string;
  }> => {
    recheckConnection();

    // Return current state immediately, the query will update
    return { success: isConnected, message: connectionMessage };
  }, [recheckConnection, isConnected, connectionMessage]);

  const getCaldavPassword = useCallback(async (): Promise<string | null> => {
    // The password is already loaded via the query
    return storedPassword;
  }, [storedPassword]);

  return (
    <CalDavSettingsContext.Provider
      value={{
        config,
        isLoading: isLoadingConfig || isLoadingSyncStatus,
        syncStatuses,
        syncStatusPage,
        syncStatusTotal,
        syncStatusSummary,
        setSyncStatusPage,
        syncStatusFilter,
        setSyncStatusFilter,
        isConnected,
        connectionMessage,
        isCheckingConnection,
        saveConfig,
        testConnection,
        deleteConfig,
        triggerManualSync,
        syncAll,
        checkConnectionStatus,
        getCaldavPassword,
        isSavingConfig,
        isTestingConnection,
        isDeletingConfig,
        isTriggeringSync,
      }}
    >
      {children}
    </CalDavSettingsContext.Provider>
  );
}

export function useCalDavSettingsContext() {
  const context = useContext(CalDavSettingsContext);

  if (!context) {
    throw new Error("useCalDavSettingsContext must be used within CalDavSettingsProvider");
  }

  return context;
}
