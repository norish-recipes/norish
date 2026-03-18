"use client";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { useTranslations } from "next-intl";

import ArchiveImporter from "@/components/navbar/archive-importer";

export default function ArchiveImportCard() {
  const t = useTranslations("settings.user.archiveImport");

  return (
    <Card>
      <CardHeader>
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-default-500 mt-1 text-base">{t("description")}</p>
        </div>
      </CardHeader>
      <CardBody>
        <ArchiveImporter />
      </CardBody>
    </Card>
  );
}
