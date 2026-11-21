"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ClockIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";

import type { CaldavShape } from "./caldav-shape";

export default function CaldavSkeleton({ shape }: { shape: CaldavShape }) {
  return (
    <SettingsCardsSkeleton
      cards={
        shape === "none"
          ? [{ icon: ServerIcon, section: "caldav.setup", description: true, rows: 5 }]
          : [
              { icon: ServerIcon, section: "caldav.config", rows: 1 },
              ...(shape === "enabled"
                ? [{ icon: ClockIcon, section: "caldav.syncStatus", rows: 3 }]
                : []),
            ]
      }
    />
  );
}
