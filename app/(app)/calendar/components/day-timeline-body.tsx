"use client";

import {
  ShoppingBagIcon,
  DocumentIcon,
  TrashIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useRef, useState, useCallback, useEffect } from "react";
import { PanInfo } from "framer-motion";

import { DraggableCalendarItem } from "./draggable-calendar-item";

import { CalendarItemViewDto, CaldavItemType } from "@/types";
import SwipeableRow, { SwipeableRowRef, SwipeAction } from "@/components/shared/swipable-row";
import { MiniGroceries } from "@/components/Panel/consumers";
import { MealIcon } from "@/lib/meal-icon";

const truncate = (text: string, maxChars: number) =>
  text.length > maxChars ? text.slice(0, maxChars).trim() + "…" : text;

type DayTimelineBodyProps = {
  items: CalendarItemViewDto[];
  onDelete: (id: string, itemType: CaldavItemType) => void;
  onDragStart?: (itemId: string, currentDate: string) => void;
  onDragEnd?: (itemId: string, currentDate: string, info: PanInfo) => void;
  isDraggingAny: boolean;
};

export function DayTimelineBody({
  items,
  onDelete,
  onDragStart,
  onDragEnd,
  isDraggingAny,
}: DayTimelineBodyProps) {
  const rowRefs = useRef<Record<string, SwipeableRowRef | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [maxChars, setMaxChars] = useState(25);
  const [groceriesOpen, setGroceriesOpen] = useState(false);
  const [currentRecipeId, setCurrentRecipeId] = useState<string | null>(null);

  // Measure container width and calculate max chars
  useEffect(() => {
    const updateMaxChars = () => {
      const width = containerRef.current?.clientWidth || 200;
      // ~8px per char, subtract space for icon (24px) + gap (8px) + button (32px) + padding
      const availableWidth = width - 72;

      setMaxChars(Math.max(10, Math.floor(availableWidth / 8)));
    };

    updateMaxChars();
    window.addEventListener("resize", updateMaxChars);

    return () => window.removeEventListener("resize", updateMaxChars);
  }, []);

  const openGroceries = useCallback((recipeId: string) => {
    setCurrentRecipeId(recipeId);
    setGroceriesOpen(true);
  }, []);

  const handleDragStart = useCallback(
    (itemId: string, currentDate: string) => {
      // Close open rows
      Object.values(rowRefs.current).forEach((ref) => ref?.closeRow());
      onDragStart?.(itemId, currentDate);
    },
    [onDragStart]
  );

  const navigateToRecipe = useCallback((recipeId: string) => {
    window.location.href = `/recipes/${recipeId}`;
  }, []);

  const getItemActions = useCallback(
    (item: CalendarItemViewDto): SwipeAction[] => {
      const hasRecipe = item.itemType === "recipe" || (item.itemType === "note" && item.recipeId);
      const actions: SwipeAction[] = [];

      if (hasRecipe) {
        const recipeId = item.itemType === "recipe" ? item.recipeId : item.recipeId!;

        actions.push({
          key: "groceries",
          icon: ShoppingBagIcon,
          color: "blue",
          onPress: () => openGroceries(recipeId),
          label: "View groceries",
        });

        actions.push({
          key: "recipe",
          icon: DocumentIcon,
          color: "yellow",
          onPress: () => navigateToRecipe(recipeId),
          label: "Go to recipe",
        });
      }

      actions.push({
        key: "delete",
        icon: TrashIcon,
        color: "danger",
        onPress: () => onDelete(item.id, item.itemType),
        primary: true,
        label: "Delete item",
      });

      return actions;
    },
    [openGroceries, navigateToRecipe, onDelete]
  );

  if (!items?.length) {
    return <span className="text-default-400 text-xs">No items</span>;
  }

  return (
    <>
      <div className="flex w-full flex-col">
        {items.map((it, index) => {
          const displayName = it.itemType === "recipe" ? it.recipeName : it.title;
          const actions = getItemActions(it);

          return (
            <div key={it.id}>
              <DraggableCalendarItem
                isDraggingAny={isDraggingAny}
                item={it}
                onDragEnd={onDragEnd}
                onDragStart={handleDragStart}
              >
                <SwipeableRow
                  ref={(el) => {
                    if (el) {
                      rowRefs.current[it.id] = el;
                    } else {
                      delete rowRefs.current[it.id];
                    }
                  }}
                  actions={actions}
                  rowHeight={48}
                >
                  <div className="flex h-full w-full items-center justify-between px-2">
                    <div ref={containerRef} className="flex min-w-0 flex-1 items-center gap-2">
                      <MealIcon slot={it.slot} />
                      <span
                        className={`text-sm md:text-base ${it.itemType === "note" ? "text-default-600 italic" : "text-foreground"} ${it.itemType === "recipe" ? "hover:text-primary cursor-pointer" : ""}`}
                        title={
                          displayName && displayName.length > maxChars ? displayName : undefined
                        }
                        onDoubleClick={
                          it.itemType === "recipe" ? () => navigateToRecipe(it.recipeId) : undefined
                        }
                      >
                        {truncate(displayName || "", maxChars)}
                      </span>
                    </div>

                    {/* Desktop trigger: opens swipe actions */}
                    <div className="hidden md:block">
                      <Button
                        key={`button-${index}`}
                        isIconOnly
                        aria-label="Item actions"
                        className="min-w-0 bg-transparent p-1 shadow-none data-[hover=true]:bg-transparent"
                        radius="none"
                        size="sm"
                        variant="light"
                        onPress={() => rowRefs.current[it.id]?.openRow()}
                      >
                        <EllipsisHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </SwipeableRow>
              </DraggableCalendarItem>
            </div>
          );
        })}
      </div>
      {currentRecipeId && (
        <MiniGroceries
          open={groceriesOpen}
          recipeId={currentRecipeId}
          onOpenChange={setGroceriesOpen}
        />
      )}
    </>
  );
}
