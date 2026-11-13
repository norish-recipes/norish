"use client";

import { ReadonlyRecipeNotes } from "@/features/recipes/components/read-only";
import { useHiddenItemVisibility } from "@/hooks/use-hidden-item-visibility";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import { usePageRecipe } from "@norish/shared-react/recipes";

/**
 * Whether the notes section has anything to show: a stored note, for a
 * reader who has not hidden notes. The page layouts read this too, so the
 * rules they draw between sections come from the same answer the card
 * itself renders by — the same shape Recipe Provenance and Nutrition
 * Information already follow.
 */
export function useNotesSectionVisible(): boolean {
  const recipe = usePageRecipe();
  const { showNotes } = useHiddenItemVisibility();

  return Boolean(recipe?.notes) && showNotes;
}

/** The notes card, on both recipe pages. */
export default function NotesCard() {
  const recipe = usePageRecipe();
  const t = useTranslations("recipes.detail");
  const isVisible = useNotesSectionVisible();

  if (!recipe?.notes || !isVisible) return null;

  return (
    <Card className="rounded-2xl">
      <Card.Header className="flex-row items-center justify-between px-6 pt-6 text-left">
        <h2 className="text-lg font-semibold">{t("notes")}</h2>
      </Card.Header>
      <Card.Content className="p-6 pt-0">
        <ReadonlyRecipeNotes notes={recipe.notes} />
      </Card.Content>
    </Card>
  );
}
