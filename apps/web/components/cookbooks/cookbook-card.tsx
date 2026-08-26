"use client";

import type { MouseEvent } from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CookbookCover from "@/components/cookbooks/cookbook-cover";
import { CookbookIconSolid } from "@/components/cookbooks/cookbook-icon";
import {
  CookbookAllergenChips,
  CookbookMetadata,
  VISIBLE_ALLERGENS_IN_ROW,
} from "@/components/cookbooks/cookbook-metadata";
import { CookbookEditPanel, DeleteCookbookModal } from "@/components/cookbooks/cookbook-panels";
import { photoChipClassName } from "@/components/dashboard/recipe-metadata";
import { usePermissionsContext } from "@/context/permissions-context";
import { useMountedOnceOpened } from "@/hooks/use-mounted-once-opened";
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/20/solid";
import { Button, Card, Tooltip } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { formatMinutesHM, isAllergenTag } from "@norish/shared/lib/helpers";

import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";

type CookbookCardProps = {
  cookbook: CookbookSummaryDTO;
  /** The reader's own allergy list, so the card can name what is in here. */
  allergies: string[];
  variant?: "grid" | "list";
  onDelete: (input: { id: string; version: number }) => void;
};

/**
 * A cookbook on the Library.
 *
 * It reads like a recipe card on purpose — the same cover, the same metadata
 * chips in the same corner, the same description slot — because it stands in
 * the same list under the same sort and a row that looked like a different
 * kind of object would break the one thing ADR-0026 is protecting. What it
 * says in those slots is the set's own answer: every member's time added up,
 * the smallest number of people any member serves, and the allergens the
 * reader would meet somewhere inside. All of it is derived from the members
 * at read time, so a cookbook still stores nothing but its title.
 *
 * Its outer heights match the recipe card's exactly — 340px in grid, 128px in
 * list — because the window virtualizer estimates one row height per view
 * mode and a mixed page degrades for every row if the two disagree.
 */
function CookbookCardComponent({
  cookbook,
  allergies,
  variant = "grid",
  onDelete,
}: CookbookCardProps) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const t = useTranslations("recipes.cookbooks");
  const { canEditRecipe, canDeleteRecipe } = usePermissionsContext();
  const [rowOpen, setRowOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // The edit panel reads this cookbook's members, and cards are virtualized:
  // mounting it before it is ever opened would fire that read every time the
  // card scrolls back into view.
  const editMounted = useMountedOnceOpened(editOpen);
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
        key: "edit",
        icon: PencilSquareIcon,
        color: "accent",
        onPress: () => setEditOpen(true),
        label: t("editTitle"),
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

  /*
   * The facts a cookbook derives from its members, read in one place and with
   * a floor under each.
   *
   * A card renders whatever the query cache holds, and a cache restored from a
   * build made before these fields existed carries cookbook rows without them:
   * the cache buster keys on the app version, which does not move while a
   * release is being built, so a contract change inside one release cycle is
   * exactly the case it does not catch. The contract says these are always
   * there and for anything fetched they are — this is the floor for rows that
   * were already on the device, so an upgrade is an emptier card for one
   * refetch rather than a Library that will not paint.
   */
  const { memberTitles = [], memberTags = [], totalMinutes = null, minServings = null } = cookbook;

  // The description a cookbook never stored: what is actually inside it.
  const description = memberTitles.join(", ");
  const timeLabel = formatMinutesHM(totalMinutes ?? undefined);
  // Cook the whole cookbook and the smallest member is what it feeds without
  // scaling something up, so that is the honest number to put on the card.
  const servings = minServings;
  const allergySet = useMemo(
    () => new Set(allergies.map((allergy) => allergy.toLowerCase())),
    [allergies]
  );
  // Only the reader's own allergens, not every tag the members carry: a
  // cookbook is a set of other people's recipes and the warning is the part
  // worth the space.
  const allergens = useMemo(
    () => memberTags.filter((tag) => isAllergenTag(tag, allergySet)),
    [memberTags, allergySet]
  );
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

  const listChipClassName = "rounded-full px-2 text-[11px]";

  const metadataChips = (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-hidden"
      title={allergens.length > 0 ? allergens.join(", ") : undefined}
    >
      <CookbookMetadata
        allergens={allergens}
        chipClassName={listChipClassName}
        chipVariant="tertiary"
        iconClassName="h-3.5 w-3.5"
        memberCount={cookbook.memberCount}
        servings={servings}
        timeLabel={timeLabel}
        visibleAllergens={VISIBLE_ALLERGENS_IN_ROW}
      />
    </div>
  );

  // Over the cover, chips carry their own contrast rather than tinting the
  // picture — the same rule the recipe card follows (ADR-0020). The allergens
  // are not here: in grid they run along the bottom of the cover, where the
  // recipe card puts its tags.
  const coverMetadata = (
    <div className="pointer-events-none absolute top-2 right-2 z-20 flex items-center gap-2">
      <CookbookMetadata
        chipClassName={photoChipClassName}
        chipVariant="soft"
        iconClassName="h-4 w-4"
        memberCount={cookbook.memberCount}
        servings={servings}
        timeLabel={timeLabel}
      />

      <div className="pointer-events-auto" role="presentation" onClick={stopParentActivation}>
        <Button
          isIconOnly
          aria-label={t("options")}
          className="bg-surface text-foreground h-6 w-6 min-w-0 p-0 shadow-md"
          size="sm"
          type="button"
          variant="tertiary"
          onPress={() => {
            if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
            else rowRef.current?.openRow();
          }}
        >
          <EllipsisHorizontalIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  /**
   * The mark that says this row is a cookbook rather than a recipe.
   *
   * Deliberately quiet: the cover mosaic and the recipe count already say it,
   * so this only has to settle the case where a cookbook holds one recipe and
   * its cover is that recipe's photo.
   */
  const kindMark = (
    <CookbookIconSolid
      aria-hidden
      className="text-muted mr-1.5 inline-block size-4 shrink-0 align-[-2px]"
    />
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
                  {kindMark}
                  {cookbook.title}
                </h3>
                {description && (
                  <p className="text-muted mt-1 truncate text-sm" title={description}>
                    {description}
                  </p>
                )}
                <div className="mt-3">{metadataChips}</div>
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
              {coverMetadata}
              {allergens.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap gap-2 overflow-hidden p-2">
                  <CookbookAllergenChips allergens={allergens} chipClassName="shadow-md" />
                </div>
              )}
            </div>

            <Card.Content className="h-[104px] overflow-hidden px-4 pt-3 pb-3">
              <h3
                className={`text-foreground truncate text-base font-semibold ${rowOpen ? "" : "group-hover/row:underline"}`}
                title={cookbook.title}
              >
                {kindMark}
                {cookbook.title}
              </h3>
              {description && (
                <p
                  className="text-muted mt-1 text-sm"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                  title={description}
                >
                  {description}
                </p>
              )}
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

      {editMounted && (
        <CookbookEditPanel cookbook={cookbook} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <DeleteCookbookModal
        isOpen={deleteOpen}
        title={cookbook.title}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}

// Absent on a row restored from a cache older than the field, so this compares
// what is there rather than trusting the contract — the comparator runs before
// the component that puts a floor under them.
function sameStrings(a: readonly string[] = [], b: readonly string[] = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

const CookbookCard = memo(CookbookCardComponent, (previous, next) => {
  if (previous.variant !== next.variant) return false;
  if (previous.allergies !== next.allergies) return false;
  if (previous.onDelete !== next.onDelete) return false;

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
      a.totalMinutes === b.totalMinutes &&
      a.minServings === b.minServings &&
      sameStrings(a.coverImages, b.coverImages) &&
      sameStrings(a.memberTitles, b.memberTitles) &&
      sameStrings(a.memberTags, b.memberTags))
  );
});

CookbookCard.displayName = "CookbookCard";

export default CookbookCard;
