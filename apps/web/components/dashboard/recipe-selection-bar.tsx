"use client";

import { useState } from "react";
import { SelectionCookbooksPanel } from "@/components/cookbooks/selection-cookbooks-panel";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { ActionBar, actionBarButtonClassName } from "@/components/ui/action-bar";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipeSelection } from "@/context/recipe-selection-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useCookbooksMutations } from "@/hooks/cookbooks";
import { BookOpenIcon, MinusCircleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

/**
 * The action bar over a page's recipe selection: the count, the actions and
 * the way out. On a cookbook page it also takes the selection out of that
 * cookbook, and `onLeave` drops rows from its member list.
 */
export default function RecipeSelectionBar({
  cookbook,
  onLeave,
}: {
  cookbook?: CookbookSummaryDTO;
  onLeave?: (recipeIds: string[]) => void;
}) {
  const selection = useRecipeSelection();
  const t = useTranslations("recipes.selection");
  const tActions = useTranslations("common.actions");
  const { canDeleteRecipe } = usePermissionsContext();
  const { deleteRecipes } = useRecipesContext();
  const { setMembership } = useCookbooksMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cookbooksOpen, setCookbooksOpen] = useState(false);
  const selected = selection?.selectedRecipes ?? [];
  const count = selected.length;
  // The bar fades out after the last card leaves, still naming what it held.
  const [shownCount, setShownCount] = useState(count);

  if (count > 0 && count !== shownCount) setShownCount(count);

  if (!selection) return null;

  const { clear, playLeaving, isSelecting } = selection;

  // Orphaned recipes are anyone's to delete, as a single delete has it.
  const deletable = selected.filter((recipe) => !recipe.userId || canDeleteRecipe(recipe.userId));
  const recipeIds = selected.map((recipe) => recipe.id);

  const confirmDelete = () => {
    setDeleteOpen(false);
    clear();
    playLeaving(
      deletable.map((recipe) => recipe.id),
      () => {
        deleteRecipes(deletable.map(({ id, version }) => ({ id, version })));
        onLeave?.(deletable.map((recipe) => recipe.id));
      }
    );
  };

  const removeFromCookbook = () => {
    if (!cookbook) return;
    setMembership({ cookbookId: cookbook.id, recipeIds, isMember: false, cookbook });
    onLeave?.(recipeIds);
    clear();
  };

  return (
    <>
      <ActionBar aria-label={t("toolbar")} isOpen={isSelecting}>
        <ActionBar.Prefix data-testid="selection-count">
          {t("count", { count: shownCount })}
        </ActionBar.Prefix>
        <ActionBar.Content>
          <Button
            className={actionBarButtonClassName}
            size="sm"
            variant="ghost"
            onPress={() => setCookbooksOpen(true)}
          >
            <BookOpenIcon className="size-4" />
            <ActionBar.Label>{t("addToCookbook")}</ActionBar.Label>
          </Button>
          {cookbook && (
            <Button
              className={actionBarButtonClassName}
              size="sm"
              variant="ghost"
              onPress={removeFromCookbook}
            >
              <MinusCircleIcon className="size-4" />
              <ActionBar.Label>{t("remove")}</ActionBar.Label>
            </Button>
          )}
          <Button
            className={actionBarButtonClassName}
            isDisabled={deletable.length === 0}
            size="sm"
            variant="ghost"
            onPress={() => setDeleteOpen(true)}
          >
            <TrashIcon className="size-4" />
            <ActionBar.Label>{tActions("delete")}</ActionBar.Label>
          </Button>
        </ActionBar.Content>
        <ActionBar.Suffix>
          <Button
            isIconOnly
            aria-label={t("clear")}
            className={actionBarButtonClassName}
            size="sm"
            variant="ghost"
            onPress={clear}
          >
            <XMarkIcon className="size-5" />
          </Button>
        </ActionBar.Suffix>
      </ActionBar>

      <DeleteRecipeModal
        count={deletable.length}
        isOpen={deleteOpen}
        keptCount={count - deletable.length}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />

      <SelectionCookbooksPanel
        excludeCookbookId={cookbook?.id}
        open={cookbooksOpen}
        recipeIds={recipeIds}
        onFiled={clear}
        onOpenChange={setCookbooksOpen}
      />
    </>
  );
}
