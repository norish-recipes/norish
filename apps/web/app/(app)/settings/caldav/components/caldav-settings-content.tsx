"use client";

import { CalDavSettingsProvider, useCalDavSettingsContext } from "../context";

import CalDavConfigCard from "./caldav-config-card";
import CalDavSyncStatusCard from "./caldav-sync-status-card";

import SettingsSkeleton from "@/components/skeleton/settings-skeleton";

function CalDavSettingsContent() {
  const { config, isLoading } = useCalDavSettingsContext();

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CalDavConfigCard />
      {config && config.enabled && <CalDavSyncStatusCard />}
    </div>
  );
}

export default function CalDavSettingsContentWrapper() {
  return (
    <CalDavSettingsProvider>
      <CalDavSettingsContent />
    </CalDavSettingsProvider>
  );
}
