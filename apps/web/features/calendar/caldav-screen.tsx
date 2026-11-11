"use client";

import type { CaldavShape } from "./components/caldav/caldav-shape";
import { CalDavSettingsProvider, useCalDavSettingsContext } from "./components/caldav/context";
import CalDavConfigCard from "./components/caldav/caldav-config-card";
import CaldavSkeleton from "./components/caldav/caldav-skeleton";
import CalDavSyncStatusCard from "./components/caldav/caldav-sync-status-card";

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

export function CaldavScreen({ shape }: { shape: CaldavShape }) {
  return (
    <CalDavSettingsProvider>
      <CalDavSettingsContent shape={shape} />
    </CalDavSettingsProvider>
  );
}
