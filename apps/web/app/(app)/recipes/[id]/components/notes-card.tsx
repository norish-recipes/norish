"use client";

import { useRecipeContext } from "@/app/(app)/recipes/[id]/context";
import { ReadonlyRecipeNotes } from "@/components/recipes/readonly-recipe-sections";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { Card } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Whether the notes section has anything to show: a stored note, for a
 * reader who has not hidden notes. The page layouts read this too, so the
 * rules they draw between sections come from the same answer the section
 * itself renders by — the same shape Recipe Provenance and Nutrition
 * Information already follow.
 */
export function useNotesSectionVisible(): boolean {
  const { recipe } = useRecipeContext();
  const { showNotes } = useHiddenItemVisibility();

  return Boolean(recipe?.notes) && showNotes;
}

/** The notes section on the mobile recipe page; draws no rule of its own. */
export function NotesSection() {
  const { recipe } = useRecipeContext();
  const t = useTranslations("recipes.detail");
  const isVisible = useNotesSectionVisible();

  if (!recipe?.notes || !isVisible) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("notes")}</h2>
      </div>
      <div>
        <ReadonlyRecipeNotes notes={recipe.notes} />
      </div>
    </div>
  );
}

/** The notes card on the desktop recipe page. */
export default function NotesCard() {
  const { recipe } = useRecipeContext();
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
