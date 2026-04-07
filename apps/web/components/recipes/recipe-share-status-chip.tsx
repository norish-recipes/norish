"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { RecipeShareSummaryDto } from "@norish/shared/contracts";

type Props = {
  status: RecipeShareSummaryDto["status"];
};

const statusColors: Record<Props["status"], "success" | "warning" | "default"> = {
  active: "success",
  expired: "warning",
  revoked: "default",
};

export function RecipeShareStatusChip({ status }: Props) {
  const t = useTranslations("recipes.sharePanel.status");

  return (
    <Chip color={statusColors[status]} size="sm" variant="flat">
      {t(status)}
    </Chip>
  );
}

export default RecipeShareStatusChip;
