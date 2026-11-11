"use client";

import { useCaldavConfigSlice, useCaldavSubscription } from "@norish/shared-react/calendar";

import type { CaldavShape } from "./components/caldav/caldav-shape";
import CaldavConfigCard from "./components/caldav/caldav-config-card";
import CaldavSkeleton from "./components/caldav/caldav-skeleton";
import CaldavSyncStatusCard from "./components/caldav/caldav-sync-status-card";

export function CaldavScreen({ shape }: { shape: CaldavShape }) {
  const { slice: enabled, isLoading } = useCaldavConfigSlice((config) => config?.enabled ?? false);

  useCaldavSubscription();

  if (isLoading) {
    return <CaldavSkeleton shape={shape} />;
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CaldavConfigCard />
      {enabled && <CaldavSyncStatusCard />}
    </div>
  );
}
