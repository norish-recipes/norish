"use client";

import ArchiveExportButton from "@/app/(app)/settings/components/archive-export-button";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

export default function ArchiveExportCard() {
  const t = useTranslations("settings.user.archiveExport");

  return (
    <SettingsCard description={t("description")} icon={ArrowDownTrayIcon} title={t("title")}>
      <div className="flex justify-end">
        <ArchiveExportButton label={t("button")} />
      </div>
    </SettingsCard>
  );
}
