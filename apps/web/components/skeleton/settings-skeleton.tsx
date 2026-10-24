"use client";

import type { SettingsShape, SettingsTab } from "@/app/(app)/settings/settings-tab";
import type { ComponentType, SVGProps } from "react";
import { use } from "react";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { SettingsShapeContext } from "@/app/(app)/settings/components/settings-tabs";
import { ClockIcon } from "@heroicons/react/16/solid";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  BookOpenIcon,
  CircleStackIcon,
  ClipboardDocumentIcon,
  Cog6ToothIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  KeyIcon,
  LinkIcon,
  QueueListIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCircleIcon,
  UserGroupIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

type CardPlaceholder = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The card's messages under `settings`; absent where its title depends on the reader's data. */
  section?: string;
  description?: boolean;
  danger?: boolean;
  rows: number;
};

/** The cards every reader's tab has, in its order, as the server's shape picks them. */
const tabCards = (shape: SettingsShape): Record<SettingsTab, CardPlaceholder[]> => ({
  user: [
    { icon: UserCircleIcon, section: "user.profile", rows: 2 },
    { icon: AdjustmentsHorizontalIcon, section: "user.preferences", description: true, rows: 6 },
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
  ],
  household:
    shape.household === "none"
      ? [
          { icon: HomeIcon, section: "household.create", description: true, rows: 2 },
          { icon: UserGroupIcon, section: "household.join", description: true, rows: 2 },
        ]
      : [
          // The household's name is its title.
          { icon: HomeIcon, rows: 3 },
          { icon: UserGroupIcon, section: "household.members", rows: 2 },
          ...(shape.household === "admin"
            ? [{ icon: ClipboardDocumentIcon, section: "household.joinCode", rows: 2 }]
            : []),
        ],
  caldav:
    shape.caldav === "none"
      ? [{ icon: ServerIcon, section: "caldav.setup", description: true, rows: 5 }]
      : [
          { icon: ServerIcon, section: "caldav.config", rows: 1 },
          ...(shape.caldav === "enabled"
            ? [{ icon: ClockIcon, section: "caldav.syncStatus", rows: 3 }]
            : []),
        ],
  ingredients: [
    { icon: BookOpenIcon, section: "ingredients", description: true, rows: 6 },
    { icon: CircleStackIcon, section: "ingredients.dataSources", rows: 2 },
  ],
  equipment: [{ icon: WrenchScrewdriverIcon, section: "equipment", description: true, rows: 6 }],
  admin: [
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
  ],
});

/**
 * A settings tab while it loads: its cards' real headers over grey rows. The route, the
 * tab's lazy load and its data wait all draw it.
 */
export function SettingsTabSkeleton({ tab }: { tab: SettingsTab }) {
  const t = useTranslations("settings");
  const shape = use(SettingsShapeContext);
  // Without a household, its two cards sit side by side.
  const sideBySide = tab === "household" && shape.household === "none";

  return (
    <div
      className={
        sideBySide ? "grid w-full grid-cols-1 gap-6 md:grid-cols-2" : "flex w-full flex-col gap-6"
      }
    >
      {tabCards(shape)[tab].map(({ icon, section, description, danger, rows }, index) => (
        <SettingsCard
          key={section ?? index}
          danger={danger}
          description={section && description ? t(`${section}.description`) : undefined}
          icon={icon}
          title={section ? t(`${section}.title`) : <Skeleton className="h-6 w-48 rounded-lg" />}
        >
          {Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-12 w-full rounded-lg" />
          ))}
        </SettingsCard>
      ))}
    </div>
  );
}
