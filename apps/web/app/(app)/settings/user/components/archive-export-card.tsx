"use client";

import ArchiveExportButton from "@/app/(app)/settings/components/archive-export-button";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function ArchiveExportCard() {
  const t = useTranslations("settings.user.archiveExport");

  return (
    <Card>
      <Card.Header>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>
        <div className="flex justify-end">
          <ArchiveExportButton label={t("button")} />
        </div>
      </Card.Content>
    </Card>
  );
}
