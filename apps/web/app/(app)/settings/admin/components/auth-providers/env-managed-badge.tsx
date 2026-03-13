"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

interface EnvManagedBadgeProps {
  isOverridden?: boolean;
}

export function EnvManagedBadge({ isOverridden }: EnvManagedBadgeProps) {
  const t = useTranslations("settings.admin.authProviders.envBadge");

  if (isOverridden === undefined) return null;

  return (
    <Chip color={isOverridden ? "success" : "warning"} size="sm" variant="flat">
      {isOverridden ? t("db") : t("env")}
    </Chip>
  );
}
