"use client";

import type { CaldavShape } from "@/components/settings/settings-tab";
import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import { ClockIcon } from "@heroicons/react/16/solid";
import { ServerIcon } from "@heroicons/react/24/outline";

export default function CaldavSkeleton({ caldav }: { caldav: CaldavShape }) {
  return (
    <SettingsCardsSkeleton
      cards={
        caldav === "none"
          ? [{ icon: ServerIcon, section: "caldav.setup", description: true, rows: 5 }]
          : [
              { icon: ServerIcon, section: "caldav.config", rows: 1 },
              ...(caldav === "enabled"
                ? [{ icon: ClockIcon, section: "caldav.syncStatus", rows: 3 }]
                : []),
            ]
      }
    />
  );
}
