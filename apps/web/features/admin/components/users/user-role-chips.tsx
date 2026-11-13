"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

interface UserRoleChipsProps {
  isServerOwner: boolean;
  isServerAdmin: boolean;
}

export function UserRoleChips({ isServerOwner, isServerAdmin }: UserRoleChipsProps) {
  const t = useTranslations("settings.admin.users");

  if (!isServerOwner && !isServerAdmin) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {isServerOwner ? (
        <Chip color="accent" size="sm" variant="soft">
          {t("roles.owner")}
        </Chip>
      ) : null}
      {isServerAdmin ? (
        <Chip color="success" size="sm" variant="soft">
          {t("roles.admin")}
        </Chip>
      ) : null}
    </div>
  );
}
