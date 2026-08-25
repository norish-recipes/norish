"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CookbookTitlePanel, DeleteCookbookModal } from "@/components/cookbooks/cookbook-panels";
import { NotFoundView } from "@/components/shared/not-found-view";
import { usePermissionsContext } from "@/context/permissions-context";
import { useCookbookQuery, useCookbooksMutations } from "@/hooks/cookbooks";
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, Label, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { cssButtonPill, cssButtonPillDanger } from "@norish/web/config/css-tokens";

/**
 * A cookbook's own page: its own address, so it can be linked, bookmarked and
 * reached with the back button.
 *
 * The title carries the same Rename and Delete the card carries, so a name can
 * be fixed without leaving the thing being renamed.
 */
export default function CookbookPage({ cookbookId }: { cookbookId: string }) {
  const router = useRouter();
  const t = useTranslations("recipes.cookbooks");
  const { cookbook, isNotFound } = useCookbookQuery(cookbookId);
  const { renameCookbook, deleteCookbook } = useCookbooksMutations();
  const { canEditRecipe, canDeleteRecipe } = usePermissionsContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = useCallback(() => {
    if (!cookbook) return;
    setDeleteOpen(false);
    deleteCookbook({ id: cookbook.id, version: cookbook.version });
    router.push("/");
  }, [cookbook, deleteCookbook, router]);

  const handleRename = useCallback(
    (title: string) => {
      if (!cookbook) return;
      renameCookbook({ id: cookbook.id, title, version: cookbook.version });
    },
    [cookbook, renameCookbook]
  );

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
    <section aria-labelledby="cookbook-heading" className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1
            className="text-foreground truncate text-2xl leading-8 font-semibold"
            id="cookbook-heading"
          >
            {cookbook.title}
          </h1>
          <span className="text-muted shrink-0 text-sm">
            {t("recipeCount", { count: cookbook.memberCount })}
          </span>
        </div>

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
                    key="rename"
                    className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
                    id="rename"
                    textValue={t("renameTitle")}
                  >
                    <Button
                      className={twMerge("w-full justify-start bg-transparent", cssButtonPill)}
                      size="md"
                      variant="tertiary"
                      // The menu closes before the action runs, so its items
                      // cannot rebuild mid-exit and steal focus from the panel
                      // the action opens.
                      onPress={() => {
                        setMenuOpen(false);
                        setRenameOpen(true);
                      }}
                    >
                      <PencilSquareIcon className="text-muted size-4" />
                      <Label className="text-sm font-medium">{t("renameTitle")}</Label>
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
                      <Label className="text-danger text-sm font-medium">{t("deleteTitle")}</Label>
                    </Button>
                  </Dropdown.Item>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>

      <CookbookTitlePanel
        initialTitle={cookbook.title}
        mode="rename"
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onSubmit={handleRename}
      />

      <DeleteCookbookModal
        isOpen={deleteOpen}
        title={cookbook.title}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
