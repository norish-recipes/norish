"use client";

import ArchiveExportButton from "@/components/settings/archive-export-button";
import { SettingsCard } from "@/components/settings/settings-card";
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
