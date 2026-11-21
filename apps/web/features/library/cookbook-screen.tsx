"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NotFoundView } from "@/components/shared/not-found-view";
import CookbookMembers from "@/features/library/components/grid/cookbook-members";
import { RecipeViewModeTabs } from "@/features/library/components/header";
import CookbookHeader, {
  COOKBOOK_HEADING_ID,
} from "@/features/library/components/header/cookbook-header";
import {
  CookbookAddRecipesPanel,
  CookbookEditPanel,
  DeleteCookbookModal,
} from "@/features/library/components/panels";
import { CookbookSelectionBar } from "@/features/library/components/selection/cookbook-selection-bar";
import CookbookSkeleton from "@/features/library/components/skeleton/cookbook-skeleton";
import {
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { ownerAllows, useRecipePermissions } from "@norish/shared-react/reader";
import { useCookbookQuery, useCookbooksMutations } from "@norish/shared-react/recipes";
import {
  cssButtonPill,
  cssButtonPillDanger,
  cssHeaderIcon,
  cssHeaderIconControl,
} from "@norish/web/config/css-tokens";

/**
 * A cookbook's own page: its own address, so it can be linked, bookmarked and
 * reached with the back button.
 *
 * Its members render through the Library's grid in the reader's grid or list
 * (the Library's own Device Preference), under their own sort, search and
 * filters. The title carries the same
 * Rename and Delete the card carries, so a name can be fixed without leaving
 * the thing being renamed.
 */
export function CookbookScreen({ cookbookId }: { cookbookId: string }) {
  const router = useRouter();
  const t = useTranslations("recipes.cookbooks");
  const { cookbook, isNotFound } = useCookbookQuery(cookbookId);
  const { deleteCookbook } = useCookbooksMutations();
  const { canEditRecipe, canDeleteRecipe } = useRecipePermissions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    if (!cookbook) return;
    setDeleteOpen(false);
    deleteCookbook({ id: cookbook.id, version: cookbook.version });
    router.push("/");
  };

  if (isNotFound) {
    return <NotFoundView message={t("notFoundHint")} title={t("notFound")} />;
  }

  if (!cookbook) return <CookbookSkeleton />;

  // Cookbooks answer to the recipe permission policy (ADR-0027).
  const canEdit = ownerAllows(cookbook.userId, canEditRecipe);
  const canDelete = ownerAllows(cookbook.userId, canDeleteRecipe);

  return (
    <section aria-labelledby={COOKBOOK_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <RecipeViewModeTabs>
        <CookbookHeader
          actions={
            (canEdit || canDelete) && (
              <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
                <Button
                  isIconOnly
                  aria-label={t("options")}
                  className={`transition active:scale-95 ${cssHeaderIconControl}`}
                  size="md"
                  variant="tertiary"
                >
                  <EllipsisHorizontalIcon className={cssHeaderIcon} />
                </Button>
                <Dropdown.Popover className="bg-overlay z-[500]" placement="bottom end">
                  <Dropdown.Menu aria-label={t("options")}>
                    {canEdit ? (
                      <Dropdown.Item
                        key="add"
                        className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                        id="add"
                        textValue={t("addRecipes")}
                      >
                        <Button
                          className={twMerge("w-full justify-start bg-transparent", cssButtonPill)}
                          size="md"
                          variant="tertiary"
                          onPress={() => {
                            setMenuOpen(false);
                            setAddOpen(true);
                          }}
                        >
                          <PlusIcon className="text-muted size-4" />
                          <Label className="text-sm font-medium">{t("addRecipes")}</Label>
                        </Button>
                      </Dropdown.Item>
                    ) : null}
                    {canEdit ? (
                      <Dropdown.Item
                        key="edit"
                        className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                        id="edit"
                        textValue={t("editTitle")}
                      >
                        <Button
                          className={twMerge("w-full justify-start bg-transparent", cssButtonPill)}
                          size="md"
                          variant="tertiary"
                          // The menu closes before the action runs, so its items cannot rebuild
                          // mid-exit and steal focus from the panel the action opens.
                          onPress={() => {
                            setMenuOpen(false);
                            setEditOpen(true);
                          }}
                        >
                          <PencilSquareIcon className="text-muted size-4" />
                          <Label className="text-sm font-medium">{t("editTitle")}</Label>
                        </Button>
                      </Dropdown.Item>
                    ) : null}
                    {canDelete ? (
                      <Dropdown.Item
                        key="delete"
                        className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                        id="delete"
                        textValue={t("deleteTitle")}
                      >
                        <Button
                          className={twMerge(
                            "w-full justify-start bg-transparent",
                            cssButtonPillDanger
                          )}
                          size="md"
                          variant="tertiary"
                          onPress={() => {
                            setMenuOpen(false);
                            setDeleteOpen(true);
                          }}
                        >
                          <TrashIcon className="text-danger size-4" />
                          <Label className="text-danger text-sm font-medium">
                            {t("deleteTitle")}
                          </Label>
                        </Button>
                      </Dropdown.Item>
                    ) : null}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )
          }
          cookbook={cookbook}
        />

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          <CookbookMembers cookbookId={cookbookId} variant="grid" />
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          <CookbookMembers cookbookId={cookbookId} variant="list" />
        </Tabs.Panel>
      </RecipeViewModeTabs>
      <CookbookSelectionBar cookbook={cookbook} />

      <CookbookEditPanel cookbook={cookbook} open={editOpen} onOpenChange={setEditOpen} />

      <CookbookAddRecipesPanel cookbook={cookbook} open={addOpen} onOpenChange={setAddOpen} />

      <DeleteCookbookModal
        isOpen={deleteOpen}
        title={cookbook.title}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
