"use client";

import { useState, useTransition, useCallback, ChangeEvent } from "react";
import { Virtuoso } from "react-virtuoso";
import { Image, Input, Button } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusIcon } from "@heroicons/react/16/solid";

import Panel from "@/components/Panel/Panel";
import { RecipeDashboardDTO, Slot } from "@/types";
import { useRecipesQuery } from "@/hooks/recipes";
import MiniRecipeSkeleton from "@/components/skeleton/mini-recipe-skeleton";
import { dateKey } from "@/lib/helpers";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { SlotDropdown } from "@/components/shared/slot-dropdown";

type MiniRecipesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
};

function MiniRecipesContent({
  date,
  onOpenChange,
}: {
  date: Date;
  onOpenChange: (open: boolean) => void;
}) {
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
      planMeal(dateString, slot, recipe.id, recipe.name, recipe.tags.map((t) => t.name));
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
          placeholder="Search recipes…"
          style={{ fontSize: "16px" }}
          value={rawInput}
          onChange={handleInputChange}
        />
        <div className="flex flex-1 items-center justify-center text-sm text-red-500">
          Failed to load recipes.
        </div>
      </div>
    );
  }

  const showAddNote = rawInput.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        placeholder="Search recipes…"
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
                <span className="truncate">Add Note: {rawInput}</span>
              </Button>
            </SlotDropdown>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1">
        {isLoading && !recipes.length ? (
          <MiniRecipeSkeleton />
        ) : !isLoading && recipes.length === 0 ? (
          <div className="text-default-500 flex h-full items-center justify-center text-sm">
            No recipes found.
          </div>
        ) : (
          <Virtuoso
            data={recipes}
            endReached={loadMore}
            itemContent={(_, recipe) => {
              const subtitle = (recipe.description?.trim() || "").slice(0, 140);

              return (
                <SlotDropdown
                  ariaLabel="Choose slot"
                  onSelectSlot={(slot) => handlePlan(recipe, slot)}
                >
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
                      {subtitle && (
                        <div className="text-default-500 truncate text-sm">{subtitle}</div>
                      )}
                    </div>
                  </div>
                </SlotDropdown>
              );
            }}
            overscan={200}
            style={{ height: "100%" }}
          />
        )}
      </div>
    </div>
  );
}

export default function MiniRecipes({ open, onOpenChange, date }: MiniRecipesProps) {
  return (
    <Panel open={open} title="Add Recipe" onOpenChange={onOpenChange}>
      {open && <MiniRecipesContent date={date} onOpenChange={onOpenChange} />}
    </Panel>
  );
}
