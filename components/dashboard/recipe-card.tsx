"use client";

import { ShoppingBagIcon, CalendarDaysIcon, TrashIcon } from "@heroicons/react/20/solid";
import { Card, CardBody, Image } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import SwipeableRow, { SwipeableRowRef, SwipeAction } from "../shared/swipable-row";
import DoubleTapContainer from "../shared/double-tap-container";

import RecipeMetadata from "./recipe-metadata";
import RecipeTags from "./recipe-tags";

import { MiniCalendar, MiniGroceries } from "@/components/Panel/consumers";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import { RecipeDashboardDTO } from "@/types";
import { formatMinutesHM } from "@/lib/helpers";
import { useRecipesContext } from "@/context/recipes-context";
import { useAppStore } from "@/store/useAppStore";
import { usePermissionsContext } from "@/context/permissions-context";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";

export default function RecipeCard({ recipe }: { recipe: RecipeDashboardDTO }) {
  const router = useRouter();
  const rowRef = useRef<SwipeableRowRef>(null);
  const { mobileSearchOpen } = useAppStore((s) => s);
  const { deleteRecipe } = useRecipesContext();
  const { canDeleteRecipe } = usePermissionsContext();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const [open, setOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groceriesOpen, setGroceriesOpen] = useState(false);

  const isFavorite = checkFavorite(recipe.id);
  const averageRating = recipe.averageRating ?? null;

  const handleNavigate = useCallback(() => {
    if (recipe.id && !open && !mobileSearchOpen) {
      router.push(`/recipes/${recipe.id}`);
    }
  }, [router, recipe.id, open, mobileSearchOpen]);

  const totalMinutes =
    recipe.totalMinutes ?? ((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) || undefined);
  const timeLabel = formatMinutesHM(totalMinutes);

  const servings = recipe.servings;
  const allTags = recipe.tags ?? [];
  const description = recipe.description?.trim() || "";

  function _canClick() {
    return !open && !mobileSearchOpen;
  }

  const handleToggleFavorite = useCallback(() => {
    toggleFavorite(recipe.id);
  }, [toggleFavorite, recipe.id]);

  const deleteRecipeButton = useCallback(() => {
    deleteRecipe(recipe.id);
  }, [deleteRecipe, recipe.id]);

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
        label: "View groceries",
      },
      {
        key: "calendar",
        icon: CalendarDaysIcon,
        color: "yellow",
        onPress: () => setCalendarOpen(true),
        label: "Add to calendar",
      },
    ];

    if (showDeleteAction) {
      baseActions.push({
        key: "delete",
        icon: TrashIcon,
        color: "danger",
        onPress: deleteRecipeButton,
        primary: true,
        label: "Delete recipe",
      });
    }

    return baseActions;
  }, [showDeleteAction, deleteRecipeButton]);

  return (
    <>
      <SwipeableRow
        ref={rowRef}
        actions={actions}
        disableSwipeOnDesktop={true}
        onOpenChange={setOpen}
      >
        <div
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
                  {recipe.image ? (
                    <Image
                      removeWrapper
                      alt={recipe.name}
                      className={`h-full w-full object-cover transition-transform duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-110"} `}
                      radius="none"
                      src={recipe.image}
                    />
                  ) : (
                    <div
                      className={`bg-default-200 text-default-500 flex h-full w-full items-center justify-center transition-all duration-300 ease-in-out ${open ? "scale-100" : "group-hover/row:scale-105"} `}
                    >
                      <span className="text-sm font-medium opacity-70">No image available</span>
                    </div>
                  )}
                </div>

                {/* top meta data */}
                <RecipeMetadata
                  averageRating={averageRating}
                  isFavorite={isFavorite}
                  servings={servings}
                  timeLabel={timeLabel}
                  onOptionsPress={() => {
                    if (rowRef.current?.isOpen()) rowRef.current?.closeRow();
                    else rowRef.current?.openRow();
                  }}
                  onToggleFavorite={handleToggleFavorite}
                />

                {/* bottom tags */}
                {allTags.length > 0 && <RecipeTags tags={allTags} />}
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
      <MiniGroceries open={groceriesOpen} recipeId={recipe.id} onOpenChange={setGroceriesOpen} />
    </>
  );
}
