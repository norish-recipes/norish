"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MiniCookbooks } from "@/components/Panel/consumers";
import { DeleteRecipeModal } from "@/components/shared/delete-recipe-modal";
import { ActionBar, actionBarButtonClassName } from "@/components/ui/action-bar";
import { useRecipesMutations } from "@/hooks/use-recipes-mutations";
import { showActionToast } from "@/lib/ui/action-toast";
import { BookOpenIcon, MinusCircleIcon, TrashIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import type { SelectedRecipe } from "@norish/shared-react/recipes";
import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useRecipePermissions } from "@norish/shared-react/reader";
import { useCookbooksMutations, useRecipeSelection } from "@norish/shared-react/recipes";

import { useLeavingEndsOnUnmount, useRecipeLeaving } from "./recipe-leaving";

/**
 * The action bar over a Library page's recipe selection; `recipes` is the page's loaded list,
 * whose versions the actions send. On a cookbook page it can also take the selection out of
 * that cookbook; `onLeave` drops rows from the member list.
 */
export default function RecipeSelectionBar({
  cookbook,
  recipes,
  onLeave,
}: {
  cookbook?: CookbookSummaryDTO;
  recipes: SelectedRecipe[];
  onLeave?: (recipeIds: string[]) => void;
}) {
  const selectedById = useRecipeSelection((state) => state.selected);
  const clear = useRecipeSelection((state) => state.clear);
  const playLeaving = useRecipeLeaving((state) => state.playLeaving);
  const t = useTranslations("recipes.selection");
  const tActions = useTranslations("common.actions");
  const tToasts = useTranslations("recipes.toasts");
  const router = useRouter();
  const { canDeleteRecipe, canEditRecipe } = useRecipePermissions();
  const { deleteRecipes } = useRecipesMutations();
  const { setMembership } = useCookbooksMutations();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cookbooksOpen, setCookbooksOpen] = useState(false);
  // Each selected recipe at the newest version this page has seen.
  const loaded = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const selected = [...selectedById.values()].map((recipe) => {
    const { id, version, userId } = loaded.get(recipe.id) ?? recipe;

    return { id, version, userId };
  });
  const count = selected.length;
  const isSelecting = count > 0;
  // The bar fades out after the last card leaves, still naming what it held.
  const [shownCount, setShownCount] = useState(count);

  if (count > 0 && count !== shownCount) setShownCount(count);

  // The selection is the page's: it doesn't follow the reader into a cookbook.
  useEffect(() => clear, [clear]);
  useLeavingEndsOnUnmount();

  useEffect(() => {
    if (!isSelecting) return;

    // An overlay that closed on this Escape has already claimed it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clear();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isSelecting, clear]);

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
