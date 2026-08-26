"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CookbookEditPanel, DeleteCookbookModal } from "@/components/cookbooks/cookbook-panels";
import RecipeViewModeToggle from "@/components/dashboard/recipe-view-mode-toggle";
import SearchInput from "@/components/dashboard/search-input";
import { NotFoundView } from "@/components/shared/not-found-view";
import { usePermissionsContext } from "@/context/permissions-context";
import {
  RecipeViewModeProvider,
  useRecipeDashboardViewMode,
} from "@/context/recipe-view-mode-context";
import { useCookbookQuery, useCookbooksMutations } from "@/hooks/cookbooks";
import { recipeViewModePreference } from "@/lib/recipe-view-mode";
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, Spinner, Tabs } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { cssButtonPill, cssButtonPillDanger } from "@norish/web/config/css-tokens";

import CookbookMembers from "./cookbook-members";

const COOKBOOK_HEADING_ID = "cookbook-heading";

/**
 * A cookbook's own page: its own address, so it can be linked, bookmarked and
 * reached with the back button.
 *
 * Its members render through the Library's grid in the reader's stored view
 * mode, under their own sort, search and filters. The title carries the same
 * Rename and Delete the card carries, so a name can be fixed without leaving
 * the thing being renamed.
 */
function CookbookPageContent({ cookbookId }: { cookbookId: string }) {
  const router = useRouter();
  const [viewMode, setViewMode] = useRecipeDashboardViewMode();
  const t = useTranslations("recipes.cookbooks");
  const { cookbook, isNotFound } = useCookbookQuery(cookbookId);
  const { deleteCookbook } = useCookbooksMutations();
  const { canEditRecipe, canDeleteRecipe } = usePermissionsContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = useCallback(() => {
    if (!cookbook) return;
    setDeleteOpen(false);
    deleteCookbook({ id: cookbook.id, version: cookbook.version });
    router.push("/");
  }, [cookbook, deleteCookbook, router]);

  if (isNotFound) {
    return <NotFoundView message={t("notFoundHint")} title={t("notFound")} />;
  }

  if (!cookbook) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  // Cookbooks answer to the recipe permission policy (ADR-0027).
  const canEdit = cookbook.userId ? canEditRecipe(cookbook.userId) : true;
  const canDelete = cookbook.userId ? canDeleteRecipe(cookbook.userId) : true;

  return (
    <section aria-labelledby={COOKBOOK_HEADING_ID} className="flex min-h-0 flex-1 flex-col">
      <Tabs
        className="min-h-0 flex-1 gap-5"
        selectedKey={viewMode}
        onSelectionChange={(key) => setViewMode(recipeViewModePreference.parse(String(key)))}
      >
        <div className="flex shrink-0 flex-col gap-4">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h1
                className="text-foreground truncate text-2xl leading-8 font-semibold"
                id={COOKBOOK_HEADING_ID}
              >
                {cookbook.title}
              </h1>
              <span className="text-muted shrink-0 text-sm">
                {t("recipeCount", { count: cookbook.memberCount })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <RecipeViewModeToggle />
              {(canEdit || canDelete) && (
                <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
                  <Button
                    isIconOnly
                    aria-label={t("options")}
                    className="transition active:scale-95"
                    size="sm"
                    variant="tertiary"
                  >
                    <EllipsisHorizontalIcon className="text-muted h-5 w-5" />
                  </Button>
                  <Dropdown.Popover className="bg-overlay z-[500]" placement="bottom end">
                    <Dropdown.Menu aria-label={t("options")}>
                      {canEdit ? (
                        <Dropdown.Item
                          key="edit"
                          className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                          id="edit"
                          textValue={t("editTitle")}
                        >
                          <Button
                            className={twMerge(
                              "w-full justify-start bg-transparent",
                              cssButtonPill
                            )}
                            size="md"
                            variant="tertiary"
                            // The menu closes before the action runs, so its
                            // items cannot rebuild mid-exit and steal focus
                            // from the panel the action opens.
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
              )}
            </div>
          </div>

          <div className="min-w-0">
            <SearchInput />
          </div>
        </div>

        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="grid">
          <CookbookMembers cookbookId={cookbookId} variant="grid" />
        </Tabs.Panel>
        <Tabs.Panel className="mt-0 min-h-0 flex-1 p-0" id="list">
          <CookbookMembers cookbookId={cookbookId} variant="list" />
        </Tabs.Panel>
      </Tabs>

      <CookbookEditPanel cookbook={cookbook} open={editOpen} onOpenChange={setEditOpen} />

      <DeleteCookbookModal
        isOpen={deleteOpen}
        title={cookbook.title}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}

/**
 * The stored grid-or-list preference is the same device preference the
 * Library uses, so a cookbook looks like the rest of the app rather than
 * having a view mode of its own.
 */
export default function CookbookPage({ cookbookId }: { cookbookId: string }) {
  return (
    <RecipeViewModeProvider>
      <CookbookPageContent cookbookId={cookbookId} />
    </RecipeViewModeProvider>
  );
}
