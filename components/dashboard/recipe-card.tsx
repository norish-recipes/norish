"use client";

import { ShoppingBagIcon, CalendarDaysIcon, TrashIcon } from "@heroicons/react/20/solid";
import { Card, CardBody, useDisclosure } from "@heroui/react";
import { useRouter } from "next/navigation";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";
import DoubleTapContainer from "../shared/double-tap-container";
import FallbackImage from "../shared/fallback-image";
import { DeleteRecipeModal } from "../shared/delete-recipe-modal";

import RecipeMetadata from "./recipe-metadata";
import RecipeTags from "./recipe-tags";

import { MiniCalendar, MiniGroceries } from "@/components/Panel/consumers";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { RecipeDashboardDTO } from "@/types";
import { formatMinutesHM } from "@/lib/helpers";
import { useAppStore } from "@/store/useAppStore";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";

type RecipeCardProps = {
  recipe: RecipeDashboardDTO;
  isFavorite: boolean;
  allergies: string[];
  onToggleFavorite: (recipeId: string) => void;
  onDelete: (recipeId: string) => void;
};

function RecipeCardComponent({
  recipe,
  isFavorite: recipeIsFavorite,
  allergies,
  onToggleFavorite,
  onDelete,
}: RecipeCardProps) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const mobileSearchOpen = useAppStore((s) => s.mobileSearchOpen);
  const { canDeleteRecipe } = usePermissionsContext();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groceriesOpen, setGroceriesOpen] = useState(false);
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();
  const t = useTranslations("recipes.card");

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
  const allTags = recipe.tags ?? [];
  const description = recipe.description?.trim() || "";

  // Get thumbnail from the legacy image field
  const thumbnailImage = recipe.image;

  function _canClick() {
    return !open && !mobileSearchOpen;
  }

  const handleToggleFavorite = useCallback(() => {
    onToggleFavorite(recipe.id);
  }, [onToggleFavorite, recipe.id]);

  const handleDeleteClick = useCallback(() => {
    onDeleteModalOpen();
    // Keep the row open for the delete animation after confirmation
    setTimeout(() => rowRef.current?.openRow(), 0);
  }, [onDeleteModalOpen]);

  const handleDeleteConfirm = useCallback(() => {
    onDeleteModalClose();
    // Trigger the delete animation, then delete the recipe
    rowRef.current?.triggerDeleteAnimation(() => {
      onDelete(recipe.id);
    });
  }, [onDelete, recipe.id, onDeleteModalClose]);

  // Check if user can delete this recipe
  // Recipes without owner don not have restrictions
  const showDeleteAction = recipe.userId ? canDeleteRecipe(recipe.userId) : true;

  const actions: SwipeAction[] = useMemo(() => {
    const baseActions: SwipeAction[] = [
      {
        key: "groceries",
        icon: ShoppingBagIcon,
        color: "blue",
        onPress: () => setGroceriesOpen(true),
        label: t("viewGroceries"),
      },
      {
        key: "calendar",
        icon: CalendarDaysIcon,
        color: "yellow",
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

  return (
    <>
      <SwipeableRow
        ref={rowRef}
        actions={actions}
        disableSwipeOnDesktop={true}
        onOpenChange={setOpen}
      >
        <div
          ref={cardRef}
          data-recipe-card
          className={`relative w-full overflow-hidden transition-all duration-300 ${open ? "rounded-none opacity-70" : "rounded-xl"} `}
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
          <div className="group/row relative w-full">
            <Card
              className="relative w-full bg-transparent shadow-none focus-visible:outline-none"
              radius="none"
            >
              <DoubleTapContainer
                className="relative aspect-[4/3] w-full cursor-pointer overflow-hidden"
                disabled={open || mobileSearchOpen}
                onDoubleTap={handleToggleFavorite}
                onSingleTap={handleNavigate}
              >
                {/* Image */}
                <div className="pointer-events-none absolute inset-0 z-0">
                  {thumbnailImage ? (
                    <FallbackImage
                      removeWrapper
                      alt={recipe.name}
                      className={`h-full w-full object-cover transition-transform duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-110"} `}
                      fallbackClassName={`transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"}`}
                      fallbackMessage={t("noImage")}
                      radius="none"
                      src={thumbnailImage}
                      variant="hero"
                    />
                  ) : (
                    <div
                      className={`bg-default-200 text-default-500 flex h-full w-full items-center justify-center transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"} `}
                    >
                      <span className="text-sm font-medium opacity-70">{t("noImage")}</span>
                    </div>
                  )}
                </div>

                {/* top meta data */}
                <RecipeMetadata
                  averageRating={averageRating}
                  isFavorite={recipeIsFavorite}
                  servings={servings}
                  timeLabel={timeLabel}
                  onOptionsPress={() => {
                    if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
                    else rowRef.current?.openRow();
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />

                {/* bottom tags */}
                {allTags.length > 0 && <RecipeTags allergies={allergies} tags={allTags} />}
              </DoubleTapContainer>

              {/* Body*/}
              <CardBody className="py-3 pr-3 pl-0">
                <h3
                  className={`text-foreground truncate text-base font-semibold ${open ? "" : "group-hover/row:underline"} `}
                  title={recipe.name}
                >
                  {recipe.name}
                </h3>

                {description && (
                  <p
                    className="text-default-500 mt-1 text-sm"
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
              </CardBody>
            </Card>
          </div>
        </div>
      </SwipeableRow>

      {/* Calendar panel */}
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
    prev.tags?.length === next.tags?.length
  );
});

RecipeCard.displayName = "RecipeCard";

export default RecipeCard;
