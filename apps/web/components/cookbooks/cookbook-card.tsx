"use client";

import type { MouseEvent } from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import { CookbookTitlePanel, DeleteCookbookModal } from "@/components/cookbooks/cookbook-panels";
import { usePermissionsContext } from "@/context/permissions-context";
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/20/solid";
import { Button, Card, Chip, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";

import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";

type CookbookCardProps = {
  cookbook: CookbookSummaryDTO;
  variant?: "grid" | "list";
  onRename: (input: { id: string; title: string; version: number }) => void;
  onDelete: (input: { id: string; version: number }) => void;
};

/**
 * A cookbook on the Library.
 *
 * Its outer heights match the recipe card's exactly — 340px in grid, 128px in
 * list — because the window virtualizer estimates one row height per view
 * mode and a mixed page degrades for every row if the two disagree
 * (ADR-0026).
 */
function CookbookCardComponent({
  cookbook,
  variant = "grid",
  onRename,
  onDelete,
}: CookbookCardProps) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const t = useTranslations("recipes.cookbooks");
  const { canEditRecipe, canDeleteRecipe } = usePermissionsContext();
  const [rowOpen, setRowOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Cookbooks answer to the recipe permission policy, so the same two
  // predicates the recipe card uses decide the menu here (ADR-0027).
  const canEdit = cookbook.userId ? canEditRecipe(cookbook.userId) : true;
  const canDelete = cookbook.userId ? canDeleteRecipe(cookbook.userId) : true;

  const open = useCallback(() => {
    if (!rowOpen) router.push(`/cookbooks/${cookbook.id}`);
  }, [router, cookbook.id, rowOpen]);

  const stopParentActivation = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleRename = useCallback(
    (title: string) => onRename({ id: cookbook.id, title, version: cookbook.version }),
    [onRename, cookbook.id, cookbook.version]
  );

  const handleDelete = useCallback(() => {
    setDeleteOpen(false);
    rowRef.current?.triggerDeleteAnimation(() => {
      onDelete({ id: cookbook.id, version: cookbook.version });
    });
  }, [onDelete, cookbook.id, cookbook.version]);

  const actions: SwipeAction[] = useMemo(() => {
    const list: SwipeAction[] = [];

    if (canEdit) {
      list.push({
        key: "rename",
        icon: PencilSquareIcon,
        color: "accent",
        onPress: () => setRenameOpen(true),
        label: t("renameTitle"),
      });
    }

    if (canDelete) {
      list.push({
        key: "delete",
        icon: TrashIcon,
        color: "danger",
        onPress: () => setDeleteOpen(true),
        primary: false,
        label: t("deleteTitle"),
      });
    }

    return list;
  }, [canEdit, canDelete, t]);

  const optionsButton = (
    <div className="hidden md:block" role="presentation" onClick={stopParentActivation}>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          aria-label={t("options")}
          className="text-muted hover:text-foreground h-8 w-8 min-w-0 shrink-0 rounded-full p-0"
          size="sm"
          type="button"
          variant="ghost"
          onPress={() => {
            if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
            else rowRef.current?.openRow();
          }}
        >
          <EllipsisHorizontalIcon className="h-5 w-5" />
        </Button>
        <Tooltip.Content placement="top">{t("options")}</Tooltip.Content>
      </Tooltip>
    </div>
  );

  const countChip = (
    <Chip className="shrink-0 rounded-full px-2 text-[11px]" size="sm" variant="tertiary">
      <Chip.Label>{t("recipeCount", { count: cookbook.memberCount })}</Chip.Label>
    </Chip>
  );

  const cardContent =
    variant === "list" ? (
      <div
        data-cookbook-card
        className={`relative h-[128px] w-full overflow-hidden transition-all duration-300 ${rowOpen ? "rounded-none opacity-70" : "rounded-2xl"}`}
        role="button"
        tabIndex={rowOpen ? 0 : -1}
        onClick={() => {
          if (rowOpen) rowRef.current?.closeRow();
          else open();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (rowOpen) rowRef.current?.closeRow();
            else open();
          }
        }}
      >
        <div className="group/row relative h-full w-full">
          <Card className="border-border bg-surface relative h-full w-full overflow-hidden rounded-2xl border p-0">
            <div className="flex h-full min-w-0 items-stretch">
              <div className="bg-surface-secondary relative h-full w-[112px] shrink-0 overflow-hidden">
                <CookbookCover
                  emptyIconClassName="h-8 w-8"
                  images={cookbook.coverImages}
                  title={cookbook.title}
                />
              </div>

              <Card.Content className="relative flex h-full min-w-0 flex-1 flex-col justify-center py-3 pr-4 pl-4 md:pr-12">
                <h3
                  className={`text-foreground truncate text-base leading-5 font-semibold ${rowOpen ? "" : "group-hover/row:underline"}`}
                  title={cookbook.title}
                >
                  {cookbook.title}
                </h3>
                <div className="mt-3 flex items-center gap-1.5">{countChip}</div>
                <div className="absolute top-1/2 right-3 -translate-y-1/2">{optionsButton}</div>
              </Card.Content>
            </div>
          </Card>
        </div>
      </div>
    ) : (
      <div
        data-cookbook-card
        className={`relative h-[340px] w-full overflow-hidden transition-all duration-300 ${rowOpen ? "rounded-none opacity-70" : "rounded-3xl"}`}
        role="button"
        tabIndex={rowOpen ? 0 : -1}
        onClick={() => {
          if (rowOpen) rowRef.current?.closeRow();
          else open();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (rowOpen) rowRef.current?.closeRow();
            else open();
          }
        }}
      >
        <div className="group/row relative h-full w-full">
          <Card
            className="border-border bg-surface shadow-surface relative h-full w-full gap-0 overflow-hidden rounded-3xl border p-0 focus-visible:outline-none"
            variant="default"
          >
            <div className="relative h-[236px] w-full shrink-0 overflow-hidden">
              <CookbookCover images={cookbook.coverImages} title={cookbook.title} />
              <div
                className="absolute top-2 right-2 z-10"
                role="presentation"
                onClick={stopParentActivation}
              >
                <Button
                  isIconOnly
                  aria-label={t("options")}
                  className="bg-overlay text-foreground shadow-surface h-8 w-8 min-w-0 rounded-full p-0"
                  size="sm"
                  type="button"
                  variant="ghost"
                  onPress={() => {
                    if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
                    else rowRef.current?.openRow();
                  }}
                >
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Card.Content className="h-[104px] overflow-hidden px-4 pt-3 pb-3">
              <h3
                className={`text-foreground truncate text-base font-semibold ${rowOpen ? "" : "group-hover/row:underline"}`}
                title={cookbook.title}
              >
                {cookbook.title}
              </h3>
              <div className="mt-2 flex items-center gap-1.5">{countChip}</div>
            </Card.Content>
          </Card>
        </div>
      </div>
    );

  return (
    <>
      {actions.length > 0 ? (
        <SwipeableRow
          ref={rowRef}
          disableSwipeOnDesktop
          actions={actions}
          onOpenChange={setRowOpen}
        >
          {cardContent}
        </SwipeableRow>
      ) : (
        cardContent
      )}

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
    </>
  );
}

const CookbookCard = memo(CookbookCardComponent, (previous, next) => {
  if (previous.variant !== next.variant) return false;
  if (previous.onRename !== next.onRename || previous.onDelete !== next.onDelete) return false;

  const a = previous.cookbook;
  const b = next.cookbook;

  return (
    a === b ||
    (a.id === b.id &&
      a.title === b.title &&
      a.version === b.version &&
      // The owner decides whether this card offers Rename and Delete at all,
      // so an ownership change — a cookbook becoming Orphaned — has to redraw.
      a.userId === b.userId &&
      a.memberCount === b.memberCount &&
      a.coverImages.length === b.coverImages.length &&
      a.coverImages.every((image, index) => image === b.coverImages[index]))
  );
});

CookbookCard.displayName = "CookbookCard";

export default CookbookCard;
