"use client";

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
      </Card.Content>
    </Card>
  );
}
