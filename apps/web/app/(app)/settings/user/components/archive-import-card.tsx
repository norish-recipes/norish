"use client";

import ArchiveExportButton from "@/app/(app)/settings/components/archive-export-button";
import ArchiveImporter from "@/components/navbar/archive-importer";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function ArchiveImportCard() {
  const t = useTranslations("settings.user.archiveImport");

  return (
    <Card>
      <Card.Header>
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted mt-1 text-base">{t("description")}</p>
        </div>
      </Card.Header>
      <Card.Content>
        <ArchiveImporter />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted text-base">{t("export.description")}</p>
          <ArchiveExportButton label={t("export.button")} />
        </div>
      </Card.Content>
    </Card>
  );
}
