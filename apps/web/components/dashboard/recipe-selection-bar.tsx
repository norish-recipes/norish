"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniCookbooks } from "@/components/Panel/consumers";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { ActionBar, actionBarButtonClassName } from "@/components/ui/action-bar";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipeSelection } from "@/context/recipe-selection-context";
import { useRecipesContext } from "@/context/recipes-context";
import { useCookbooksMutations } from "@/hooks/cookbooks";
import { showActionToast } from "@/lib/ui/action-toast";
import { BookOpenIcon, MinusCircleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

/**
 * The action bar over a page's recipe selection. On a cookbook page it can also take the
 * selection out of that cookbook; `onLeave` drops rows from the member list.
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
  const tToasts = useTranslations("recipes.toasts");
  const router = useRouter();
  const { canDeleteRecipe, canEditRecipe } = usePermissionsContext();
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
  // Cookbooks answer to the recipe permission policy (ADR-0027).
  const canRemove = cookbook ? !cookbook.userId || canEditRecipe(cookbook.userId) : false;

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

  const announceFiled = (filed: Array<{ id: string; title: string }>, filedCount: number) => {
    const first = filed[0];

    if (!first) return;
    showActionToast(
      filed.length === 1
        ? t("filedInto", { count: filedCount, title: first.title })
        : t("filedIntoMany", { count: filedCount, cookbooks: filed.length }),
      {
        variant: "success",
        action: { label: tToasts("open"), onPress: () => router.push(`/cookbooks/${first.id}`) },
      }
    );
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
          {canRemove && (
            <Button
              className={twMerge(actionBarButtonClassName, "text-warning")}
              size="sm"
              variant="ghost"
              onPress={removeFromCookbook}
            >
              <MinusCircleIcon className="size-4" />
              <ActionBar.Label>{t("remove")}</ActionBar.Label>
            </Button>
          )}
          <Button
            className={twMerge(actionBarButtonClassName, "text-danger")}
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

      <MiniCookbooks
        excludeCookbookId={cookbook?.id}
        open={cookbooksOpen}
        recipeIds={recipeIds}
        onOpenChange={setCookbooksOpen}
        onSaved={(filed) => {
          clear();
          announceFiled(filed, recipeIds.length);
        }}
      />
    </>
  );
}
