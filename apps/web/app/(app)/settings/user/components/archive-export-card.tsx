"use client";

import ArchiveExportButton from "@/app/(app)/settings/components/archive-export-button";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { ActionButtonGroup } from "@/components/shared/action-button";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

export default function ArchiveExportCard() {
  const t = useTranslations("settings.user.archiveExport");

  return (
    <SettingsCard description={t("description")} icon={ArrowDownTrayIcon} title={t("title")}>
      <ActionButtonGroup>
        <ArchiveExportButton label={t("button")} />
      </ActionButtonGroup>
    </SettingsCard>
  );
}
