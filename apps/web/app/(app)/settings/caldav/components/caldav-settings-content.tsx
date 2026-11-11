"use client";

import type { CaldavShape } from "./caldav-shape";
import { CalDavSettingsProvider, useCalDavSettingsContext } from "../context";
import CalDavConfigCard from "./caldav-config-card";
import CaldavSkeleton from "./caldav-skeleton";
import CalDavSyncStatusCard from "./caldav-sync-status-card";

function CalDavSettingsContent({ shape }: { shape: CaldavShape }) {
  const { config, isLoading } = useCalDavSettingsContext();

  if (isLoading) {
    return <CaldavSkeleton shape={shape} />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CalDavConfigCard />
      {config && config.enabled && <CalDavSyncStatusCard />}
    </div>
  );
}

export default function CalDavSettingsContentWrapper({ shape }: { shape: CaldavShape }) {
  return (
    <CalDavSettingsProvider>
      <CalDavSettingsContent shape={shape} />
    </CalDavSettingsProvider>
  );
}
