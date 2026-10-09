"use client";

import { Chip, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * What state an Ingredient is in, as one chip wherever the food shows: AI
 * asking about it (a round, or its own panel's question) outranks the flag,
 * since the flag is what AI is answering. Nothing for a food in neither
 * state.
 */
export function IngredientStatusChip({
  flagged,
  reviewing,
}: {
  flagged: boolean;
  reviewing: boolean;
}) {
  const t = useTranslations("settings.ingredients");

  if (reviewing) {
    return (
      <Chip color="accent" data-testid="ingredient-reviewing" size="sm" variant="soft">
        <Spinner color="current" size="sm" />
        {t("reviewing")}
      </Chip>
    );
  }
  if (flagged) {
    return (
      <Chip color="warning" data-testid="ingredient-flagged" size="sm" variant="soft">
        {t("flagged")}
      </Chip>
    );
  }

  return null;
}
