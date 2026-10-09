"use client";

import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import ArchiveImporter from "@/components/navbar/archive-importer";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

export default function ArchiveImportCard() {
  const t = useTranslations("settings.user.archiveImport");

  return (
    <SettingsCard description={t("description")} icon={ArrowUpTrayIcon} title={t("title")}>
      <ArchiveImporter />
    </SettingsCard>
  );
}
