"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

export function UnsavedChangesChip() {
  const t = useTranslations("settings.admin");

  return (
    <Chip color="warning" size="sm" variant="flat">
      {t("unsavedChanges")}
    </Chip>
  );
}
