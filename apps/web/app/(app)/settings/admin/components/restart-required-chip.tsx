"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * A chip indicating that a server restart is required for changes to take effect.
 * Used consistently across admin settings that require restart.
 */
export function RestartRequiredChip() {
  const t = useTranslations("settings.admin.authProviders");

  return (
    <Chip color="warning" size="sm" variant="flat">
      {t("requiresRestart")}
    </Chip>
  );
}
