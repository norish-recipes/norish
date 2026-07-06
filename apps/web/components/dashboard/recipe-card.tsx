"use client";

import type { MouseEvent } from "react";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MiniCalendar, MiniGroceries } from "@/components/Panel/consumers";
import HeartButton from "@/components/shared/heart-button";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { usePermissionsContext } from "@/context/permissions-context";
import { useUserContext } from "@/context/user-context";
import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";
import { useAppStore } from "@/stores/useAppStore";
import {
  CalendarDaysIcon,
  ClockIcon,
  EllipsisHorizontalIcon,
  ShoppingBagIcon,
  StarIcon,
  TrashIcon,
  UserGroupIcon,
} from "@heroicons/react/20/solid";
import { PhotoIcon } from "@heroicons/react/24/outline";
import { Button, Card, Chip, Tooltip, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import { RecipeDashboardDTO } from "@norish/shared/contracts";
import { formatMinutesHM } from "@norish/shared/lib/helpers";
import {
  getShowFavoritesPreference,
  getShowRatingsPreference,
} from "@norish/shared/lib/user-preferences";

import { DeleteRecipeModal } from "../shared/delete-recipe-modal";
import DoubleTapContainer from "../shared/double-tap-container";
import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";
import RecipeMetadata from "./recipe-metadata";
import RecipeTags from "./recipe-tags";

type RecipeCardProps = {
  recipe: RecipeDashboardDTO;
  isFavorite: boolean;
  allergies: string[];
  variant?: "grid" | "list";
  onToggleFavorite: (recipeId: string) => void;
  onDelete: (recipeId: string, version: number) => void;
};

type RecipeTagValue = RecipeDashboardDTO["tags"][number] | string | null | undefined;

function normalizeRecipeTagNames(tags: readonly RecipeTagValue[] | null | undefined) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const tag of tags ?? []) {
    const name = (typeof tag === "string" ? tag : tag?.name)?.trim();

    if (!name) continue;

    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    names.push(name);
  }

  return names;
}

function getRecipeTagsSignature(tags: RecipeDashboardDTO["tags"] | null | undefined) {
  return normalizeRecipeTagNames(tags).join("\u0000");
}

function RecipeCardComponent({
  recipe,
  isFavorite: recipeIsFavorite,
  allergies,
  variant = "grid",
  onToggleFavorite,
  onDelete,
}: RecipeCardProps) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const mobileSearchOpen = useAppStore((s) => s.mobileSearchOpen);
  const { canDeleteRecipe } = usePermissionsContext();
  const { user } = useUserContext();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groceriesOpen, setGroceriesOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const {
    isOpen: isDeleteModalOpen,
    open: onDeleteModalOpen,
    close: onDeleteModalClose,
  } = useOverlayState();
  const t = useTranslations("recipes.card");
  const showRatings = getShowRatingsPreference(user);
  const showFavorites = getShowFavoritesPreference(user);

  // Automatically prefetch recipe when card enters viewport
  const cardRef = useRecipePrefetch(recipe.id);

  const averageRating = recipe.averageRating ?? null;

  const handleNavigate = useCallback(() => {
    if (recipe.id && !open && !mobileSearchOpen) {
      // Navigate immediately - skeleton shows while data loads
      // Prefetch is already happening via useRecipePrefetch hook
      router.push(`/recipes/${recipe.id}`);
    }
  }, [router, recipe.id, open, mobileSearchOpen]);

  const totalMinutes =
    recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined);
  const timeLabel = formatMinutesHM(totalMinutes);

  const servings = recipe.servings;
  const tagNames = useMemo(() => normalizeRecipeTagNames(recipe.tags), [recipe.tags]);
  const visibleTagNames = tagNames.slice(0, 2);
  const hiddenTagCount = tagNames.length - visibleTagNames.length;
  const allTags = useMemo(() => tagNames.map((name) => ({ name })), [tagNames]);
  const description = recipe.description?.trim() || "";

  // Get thumbnail from the legacy image field
  const thumbnailImage = recipe.image;
  const showImage = thumbnailImage && failedImage !== thumbnailImage;

  function _canClick() {
    return !open && !mobileSearchOpen;
  }

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite(recipe.id);
  }, [onToggleFavorite, recipe.id]);

  const handleDeleteClick = useCallback(() => {
    onDeleteModalOpen();
  }, [onDeleteModalOpen]);

  const stopParentActivation = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    onDeleteModalClose();
    // Trigger the delete animation, then delete the recipe
    rowRef.current?.triggerDeleteAnimation(() => {
      onDelete(recipe.id, recipe.version);
    });
  }, [onDelete, recipe.id, recipe.version, onDeleteModalClose]);

  // Check if user can delete this recipe
  // Recipes without owner don not have restrictions
  const showDeleteAction = recipe.userId ? canDeleteRecipe(recipe.userId) : true;

  const actions: SwipeAction[] = useMemo(() => {
    const baseActions: SwipeAction[] = [
      {
        key: "groceries",
        icon: ShoppingBagIcon,
        color: "accent",
        onPress: () => setGroceriesOpen(true),
        label: t("viewGroceries"),
      },
      {
        key: "calendar",
        icon: CalendarDaysIcon,
        color: "warning",
        onPress: () => setCalendarOpen(true),
        label: t("addToCalendar"),
      },
    ];

    if (showDeleteAction) {
      baseActions.push({
        key: "delete",
        icon: TrashIcon,
        color: "danger",
        onPress: handleDeleteClick,
        primary: false,
        label: t("deleteRecipe"),
      });
    }

    return baseActions;
  }, [showDeleteAction, handleDeleteClick, t]);

  const optionsButton = (
    <div className="hidden md:block" role="presentation" onClick={stopParentActivation}>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          aria-label={t("recipeOptions")}
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
        <Tooltip.Content placement="top">{t("recipeOptions")}</Tooltip.Content>
      </Tooltip>
    </div>
  );

  const recipeImage = (
    iconClassName = "h-12 w-12",
    hoverScaleClass = "group-hover/row:scale-105"
  ) =>
    showImage ? (
      <img
        alt={recipe.name}
        className={`pointer-events-none h-full w-full object-cover transition-transform duration-300 ease-in-out ${open ? "scale-100" : hoverScaleClass} `}
        loading="lazy"
        src={thumbnailImage}
        onError={() => setFailedImage(thumbnailImage)}
      />
    ) : (
      <div
        className={`bg-surface-secondary text-muted flex h-full w-full items-center justify-center transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"} `}
      >
        <PhotoIcon aria-label={t("noImage")} className={`${iconClassName} opacity-70`} />
      </div>
    );

  const metadataChips = (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-hidden"
      title={tagNames.length > 0 ? tagNames.join(", ") : undefined}
    >
      {typeof averageRating === "number" && averageRating > 0 && showRatings && (
        <Chip className="shrink-0 rounded-full px-2 text-[11px]" size="sm" variant="soft">
          <StarIcon className="text-warning h-3.5 w-3.5" />
          <Chip.Label>{Math.round(averageRating)}</Chip.Label>
        </Chip>
      )}

      {timeLabel && (
        <Chip className="shrink-0 rounded-full px-2 text-[11px]" size="sm" variant="soft">
          <ClockIcon className="h-3.5 w-3.5" />
          <Chip.Label>{timeLabel}</Chip.Label>
        </Chip>
      )}

      {typeof servings === "number" && servings > 0 && (
        <Chip className="shrink-0 rounded-full px-2 text-[11px]" size="sm" variant="soft">
          <UserGroupIcon className="h-3.5 w-3.5" />
          <Chip.Label>{servings}</Chip.Label>
        </Chip>
      )}

      {visibleTagNames.map((tag) => (
        <Chip
          key={tag.toLowerCase()}
          className="max-w-[8rem] min-w-0 rounded-full px-2 text-[11px]"
          size="sm"
        >
          <Chip.Label className="truncate">{tag}</Chip.Label>
        </Chip>
      ))}

      {hiddenTagCount > 0 && (
        <Tooltip delay={0}>
          <Tooltip.Trigger aria-label={tagNames.join(", ")} onClick={stopParentActivation}>
            <Chip className="shrink-0 rounded-full px-2 text-[11px]" size="sm" variant="soft">
              <Chip.Label>+{hiddenTagCount}</Chip.Label>
            </Chip>
          </Tooltip.Trigger>
          <Tooltip.Content className="max-w-64">
            <div className="flex flex-wrap gap-1.5 p-1">
              {tagNames.map((tag) => (
                <Chip key={tag.toLowerCase()} className="max-w-48 rounded-full px-2" size="sm">
                  <Chip.Label className="truncate">{tag}</Chip.Label>
                </Chip>
              ))}
            </div>
          </Tooltip.Content>
        </Tooltip>
      )}
    </div>
  );

  const cardContent =
    variant === "list" ? (
      <div
        ref={cardRef}
        data-recipe-card
        className={`relative h-[128px] w-full overflow-hidden transition-all duration-300 ${open ? "rounded-none opacity-70" : "rounded-2xl"} `}
        role="button"
        tabIndex={open ? 0 : -1}
        onClick={() => {
          if (open) rowRef.current?.closeRow();
          else handleNavigate();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (open) rowRef.current?.closeRow();
            else handleNavigate();
          }
        }}
      >
        <div className="group/row relative h-full w-full">
          <Card className="border-border bg-surface relative h-full w-full overflow-hidden rounded-2xl border p-0">
            <div className="flex h-full min-w-0 items-stretch">
              <div role="presentation" onClick={stopParentActivation}>
                <DoubleTapContainer
                  className="bg-surface-secondary relative h-full w-[112px] shrink-0 cursor-pointer overflow-hidden"
                  disabled={open || mobileSearchOpen}
                  doubleTapEnabled={showFavorites}
                  onDoubleTap={() => {
                    if (showFavorites) handleToggleFavorite();
                  }}
                  onSingleTap={handleNavigate}
                >
                  {recipeImage("h-8 w-8")}
                  {showFavorites && (
                    <div className="pointer-events-auto absolute top-2 left-2 z-20">
                      <HeartButton
                        hideWhenNotFavorite
                        showBackground
                        isFavorite={recipeIsFavorite}
                        size="sm"
                        onToggle={handleToggleFavorite}
                      />
                    </div>
                  )}
                </DoubleTapContainer>
              </div>

              <Card.Content className="relative flex h-full min-w-0 flex-1 flex-col justify-center py-3 pr-4 pl-4 md:pr-12">
                <div className="flex min-w-0 items-start">
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`text-foreground truncate text-base leading-5 font-semibold ${open ? "" : "group-hover/row:underline"} `}
                      title={recipe.name}
                    >
                      {recipe.name}
                    </h3>
                    {description && (
                      <p className="text-muted mt-1 truncate text-sm" title={description}>
                        <SmartMarkdownRenderer disableLinks text={description} />
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3">{metadataChips}</div>
                <div className="absolute top-1/2 right-3 -translate-y-1/2">{optionsButton}</div>
              </Card.Content>
            </div>
          </Card>
        </div>
      </div>
    ) : (
      <div
        ref={cardRef}
        data-recipe-card
        className={`relative h-[340px] w-full overflow-hidden transition-all duration-300 ${open ? "rounded-none opacity-70" : "rounded-3xl"} `}
        role="button"
        tabIndex={open ? 0 : -1}
        onClick={() => {
          if (open) rowRef.current?.closeRow();
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && open) {
            e.preventDefault();
            rowRef.current?.closeRow();
          }
        }}
      >
        <div className="group/row relative h-full w-full">
          <Card
            className="border-border bg-surface shadow-surface relative h-full w-full gap-0 overflow-hidden rounded-3xl border p-0 focus-visible:outline-none"
            variant="default"
          >
            <DoubleTapContainer
              className="relative h-[236px] w-full shrink-0 cursor-pointer overflow-hidden"
              disabled={open || mobileSearchOpen}
              doubleTapEnabled={showFavorites}
              onDoubleTap={() => {
                if (showFavorites) handleToggleFavorite();
              }}
              onSingleTap={handleNavigate}
            >
              <div className="absolute inset-0 z-0">
                {recipeImage("h-12 w-12", "group-hover/row:scale-110")}
              </div>

              <RecipeMetadata
                averageRating={showRatings ? averageRating : null}
                isFavorite={recipeIsFavorite}
                servings={servings}
                timeLabel={timeLabel}
                onOptionsPress={() => {
                  if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
                  else rowRef.current?.openRow();
                }}
                onToggleFavorite={showFavorites ? handleToggleFavorite : undefined}
              />

              {allTags.length > 0 && <RecipeTags allergies={allergies} tags={allTags} />}
            </DoubleTapContainer>

            <Card.Content
              className="h-[104px] cursor-pointer overflow-hidden px-4 pt-3 pb-3"
              onClick={handleNavigate}
            >
              <h3
                className={`text-foreground truncate text-base font-semibold ${open ? "" : "group-hover/row:underline"} `}
                title={recipe.name}
              >
                {recipe.name}
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
                  <SmartMarkdownRenderer disableLinks text={description} />
                </p>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>
    );

  return (
    <>
      <SwipeableRow
        ref={rowRef}
        actions={actions}
        disableSwipeOnDesktop={true}
        onOpenChange={setOpen}
      >
        {cardContent}
      </SwipeableRow>

      {/* Calendar panel */}
      <MiniCalendar open={calendarOpen} recipeId={recipe.id} onOpenChange={setCalendarOpen} />

      {/* Groceries panel */}
      <MiniGroceries
        initialServings={recipe.servings || 1}
        open={groceriesOpen}
        originalServings={recipe.servings || 1}
        recipeId={recipe.id}
        onOpenChange={setGroceriesOpen}
      />

      <DeleteRecipeModal
        isOpen={isDeleteModalOpen}
        recipeName={recipe.name}
        onClose={onDeleteModalClose}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

// Memoize to prevent unnecessary re-renders during virtual list scroll
// The component only needs to re-render when the recipe data or favorite status changes
const RecipeCard = memo(RecipeCardComponent, (prevProps, nextProps) => {
  // Check primitive props first (cheap)
  if (prevProps.isFavorite !== nextProps.isFavorite) return false;
  if (prevProps.allergies !== nextProps.allergies) return false;
  if (prevProps.variant !== nextProps.variant) return false;
  // Functions are stable via useCallback in parent, but check identity anyway
  if (prevProps.onToggleFavorite !== nextProps.onToggleFavorite) return false;
  if (prevProps.onDelete !== nextProps.onDelete) return false;

  const prev = prevProps.recipe;
  const next = nextProps.recipe;

  // Compare essential fields that would require a re-render
  return (
    prev.id === next.id &&
    prev.name === next.name &&
    prev.description === next.description &&
    prev.image === next.image &&
    prev.servings === next.servings &&
    prev.prepMinutes === next.prepMinutes &&
    prev.cookMinutes === next.cookMinutes &&
    prev.totalMinutes === next.totalMinutes &&
    prev.averageRating === next.averageRating &&
    prev.updatedAt?.getTime() === next.updatedAt?.getTime() &&
    getRecipeTagsSignature(prev.tags) === getRecipeTagsSignature(next.tags)
  );
});

RecipeCard.displayName = "RecipeCard";

export default RecipeCard;
