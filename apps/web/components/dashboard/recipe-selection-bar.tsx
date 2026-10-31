"use client";

import { useState } from "react";
import { ActionBar, actionBarButtonClassName } from "@/components/ui/action-bar";
import { useRecipeSelection } from "@/context/recipe-selection-context";
import { XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

/** The action bar over a page's recipe selection: the count, the actions and the way out. */
export default function RecipeSelectionBar() {
  const selection = useRecipeSelection();
  const t = useTranslations("recipes.selection");
  const count = selection?.selectedRecipes.length ?? 0;
  // The bar fades out after the last card leaves, still naming what it held.
  const [shownCount, setShownCount] = useState(count);

  if (count > 0 && count !== shownCount) setShownCount(count);

  if (!selection) return null;

  return (
    <ActionBar aria-label={t("toolbar")} isOpen={selection.isSelecting}>
      <ActionBar.Prefix data-testid="selection-count">
        {t("count", { count: shownCount })}
      </ActionBar.Prefix>
      <ActionBar.Suffix>
        <Button
          isIconOnly
          aria-label={t("clear")}
          className={actionBarButtonClassName}
          size="sm"
          variant="ghost"
          onPress={selection.clear}
        >
          <XMarkIcon className="size-5" />
        </Button>
      </ActionBar.Suffix>
    </ActionBar>
  );
}
