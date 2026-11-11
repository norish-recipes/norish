"use client";

import ArchiveImporter from "@/components/navbar/archive-importer";
import { SettingsCard } from "@/components/settings/settings-card";
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
