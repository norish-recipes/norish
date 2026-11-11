"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  LinkIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export default function AccountSkeleton() {
  return (
    <SettingsCardsSkeleton
      cards={[
        { icon: UserCircleIcon, section: "user.profile", rows: 2 },
        {
          icon: AdjustmentsHorizontalIcon,
          section: "user.preferences",
          description: true,
          rows: 6,
        },
        { icon: ExclamationTriangleIcon, section: "user.allergies", description: true, rows: 1 },
        { icon: KeyIcon, section: "user.apiKeys", description: true, rows: 1 },
        { icon: LinkIcon, section: "user.shareLinks", description: true, rows: 1 },
        { icon: ShieldCheckIcon, section: "user.siteAuthTokens", description: true, rows: 1 },
        { icon: ArrowUpTrayIcon, section: "user.archiveImport", description: true, rows: 1 },
        { icon: ArrowDownTrayIcon, section: "user.archiveExport", description: true, rows: 1 },
        {
          icon: ExclamationCircleIcon,
          section: "user.dangerZone",
          description: true,
          danger: true,
          rows: 1,
        },
      ]}
    />
  );
}
