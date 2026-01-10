"use client";

import { useState, useTransition, useCallback, ChangeEvent, memo, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Image, Input, Button } from "@heroui/react";
import { motion, AnimatePresence } from "motion/react";
import { PlusIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import Panel from "@/components/Panel/Panel";
import { RecipeDashboardDTO, Slot } from "@/types";
import { useRecipesQuery } from "@/hooks/recipes";
import MiniRecipeSkeleton from "@/components/skeleton/mini-recipe-skeleton";
import { dateKey } from "@/lib/helpers";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { SlotDropdown } from "@/components/shared/slot-dropdown";

const ESTIMATED_ITEM_HEIGHT = 88; // ~80px image + 8px padding

type MiniRecipesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
};

// Memoized recipe item to prevent re-renders during scroll
const MiniRecipeItem = memo(function MiniRecipeItem({
  recipe,
  onPlan,
}: {
  recipe: RecipeDashboardDTO;
  onPlan: (recipe: RecipeDashboardDTO, slot: Slot) => void;
}) {
  const subtitle = (recipe.description?.trim() || "").slice(0, 140);

  return (
    <SlotDropdown ariaLabel="Choose slot" onSelectSlot={(slot) => onPlan(recipe, slot)}>
      <div className="hover:bg-default-100 flex cursor-pointer items-start gap-3 rounded-md px-2 py-2">
        <div className="bg-default-200 relative h-20 w-20 shrink-0 overflow-hidden rounded-md">
          {recipe.image && (
            <Image
              removeWrapper
              alt={recipe.name}
              className="h-full w-full object-cover"
              src={recipe.image}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <div className="truncate text-base font-medium">{recipe.name}</div>
          {subtitle && <div className="text-default-500 truncate text-base">{subtitle}</div>}
        </div>
      </div>
    </SlotDropdown>
  );
});

// Virtualized recipe list using TanStack Virtual
const VirtualizedRecipeList = memo(function VirtualizedRecipeList({
  recipes,
  isLoading,
  loadMore,
  noRecipesFound,
  onPlan,
}: {
  recipes: RecipeDashboardDTO[];
  isLoading: boolean;
  loadMore: () => void;
  noRecipesFound: string;
  onPlan: (recipe: RecipeDashboardDTO, slot: Slot) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggeredRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: recipes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 5,
    getItemKey: (index) => recipes[index].id,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll: trigger loadMore when near end
  useEffect(() => {
    if (virtualItems.length === 0) return;

    const lastItem = virtualItems[virtualItems.length - 1];

    if (!lastItem) return;

    // Check if we're within 3 items of the end
    const isNearEnd = lastItem.index >= recipes.length - 3;

    if (isNearEnd && !isLoading && !loadMoreTriggeredRef.current) {
      loadMoreTriggeredRef.current = true;
      loadMore();
    }

    if (!isNearEnd) {
      loadMoreTriggeredRef.current = false;
    }
  }, [virtualItems, recipes.length, isLoading, loadMore]);

  if (isLoading && !recipes.length) {
    return <MiniRecipeSkeleton />;
  }

  if (!isLoading && recipes.length === 0) {
    return (
      <div className="text-default-500 flex h-full items-center justify-center text-base">
        {noRecipesFound}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const recipe = recipes[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MiniRecipeItem recipe={recipe} onPlan={onPlan} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

function MiniRecipesContent({
  date,
  onOpenChange,
}: {
  date: Date;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calendar.panel");
  const [rawInput, setRawInput] = useState("");
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const { planMeal, planNote } = useCalendarContext();

  const {
    recipes,
    isLoading,
    error,
    hasMore: _hasMore,
    loadMore,
  } = useRecipesQuery({
    search: search || undefined,
  });

  const dateString = dateKey(date);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setRawInput(value);

    startTransition(() => {
      setSearch(value.trim());
    });
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handlePlan = useCallback(
    (recipe: RecipeDashboardDTO, slot: Slot) => {
      planMeal(
        dateString,
        slot,
        recipe.id,
        recipe.name,
        recipe.tags.map((t) => t.name)
      );
      close();
    },
    [dateString, close, planMeal]
  );

  const handlePlanNote = useCallback(
    (slot: Slot) => {
      if (rawInput.trim()) {
        planNote(dateString, slot, rawInput.trim());
        close();
      }
    },
    [dateString, rawInput, close, planNote]
  );

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Input
          placeholder={t("searchPlaceholder")}
          style={{ fontSize: "16px" }}
          value={rawInput}
          onChange={handleInputChange}
        />
        <div className="flex flex-1 items-center justify-center text-base text-red-500">
          {t("failedToLoadRecipes")}
        </div>
      </div>
    );
  }

  const showAddNote = rawInput.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        placeholder={t("searchPlaceholder")}
        style={{ fontSize: "16px" }}
        value={rawInput}
        onChange={handleInputChange}
      />

      <AnimatePresence mode="wait">
        {showAddNote && (
          <motion.div
            key="add-note-button"
            animate={{ opacity: 1, height: "auto", marginBottom: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <SlotDropdown ariaLabel="Choose slot for note" onSelectSlot={handlePlanNote}>
              <Button
                className="w-full justify-center"
                color="primary"
                size="sm"
                startContent={<PlusIcon className="h-4 w-4 shrink-0" />}
                variant="solid"
              >
                <span className="truncate">{t("addNote", { input: rawInput })}</span>
              </Button>
            </SlotDropdown>
          </motion.div>
        )}
      </AnimatePresence>

      <VirtualizedRecipeList
        isLoading={isLoading}
        loadMore={loadMore}
        noRecipesFound={t("noRecipesFound")}
        recipes={recipes}
        onPlan={handlePlan}
      />
    </div>
  );
}

export default function MiniRecipes({ open, onOpenChange, date }: MiniRecipesProps) {
  const t = useTranslations("calendar.panel");

  return (
    <Panel open={open} title={t("addRecipe")} onOpenChange={onOpenChange}>
      {open && <MiniRecipesContent date={date} onOpenChange={onOpenChange} />}
    </Panel>
  );
}
