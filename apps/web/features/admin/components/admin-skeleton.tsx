"use client";

import { SettingsCardsSkeleton } from "@/components/settings/settings-skeleton";
import {
  Cog6ToothIcon,
  DocumentMagnifyingGlassIcon,
  KeyIcon,
  LinkIcon,
  QueueListIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export default function AdminSkeleton() {
  return (
    <SettingsCardsSkeleton
      cards={[
        { icon: Cog6ToothIcon, section: "admin.general", rows: 4 },
        { icon: UsersIcon, section: "admin.users", description: true, rows: 2 },
        { icon: ShieldCheckIcon, section: "admin.permissions", description: true, rows: 4 },
        { icon: LinkIcon, section: "admin.shareLinks", description: true, rows: 1 },
        { icon: KeyIcon, section: "admin.authProviders", description: true, rows: 3 },
        {
          icon: DocumentMagnifyingGlassIcon,
          section: "admin.contentDetection",
          description: true,
          rows: 2,
        },
        { icon: SparklesIcon, section: "admin.aiProcessing", description: true, rows: 3 },
        { icon: QueueListIcon, section: "admin.jobQueue", rows: 3 },
        { icon: WrenchScrewdriverIcon, section: "admin.system", rows: 2 },
      ]}
    />
  );
}
