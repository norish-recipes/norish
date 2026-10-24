"use client";

import { Chip } from "@heroui/react";
import { useTranslations } from "next-intl";

/** A flagged Ingredient's chip, wherever the food shows; nothing for one that is not flagged. */
export function IngredientStatusChip({ flagged }: { flagged: boolean }) {
  const t = useTranslations("settings.ingredients");

  if (flagged) {
    return (
      <Chip color="warning" data-testid="ingredient-flagged" size="sm" variant="soft">
        {t("flagged")}
      </Chip>
    );
  }

  return null;
}
