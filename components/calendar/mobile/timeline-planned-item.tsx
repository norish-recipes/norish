"use client";

import type { PlannedItemDisplay } from "./types";

import { useDraggable } from "@dnd-kit/core";
import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { PlannedItemContent } from "./planned-item-content";

import { useRecipePrefetch } from "@/hooks/recipes/use-recipe-prefetch";

type TimelinePlannedItemProps = {
  item: PlannedItemDisplay;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};

export const TimelinePlannedItem = memo(function TimelinePlannedItem({
  item,
  onNoteClick,
  onRecipeClick,
}: TimelinePlannedItemProps) {
  const router = useRouter();

  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: item.id,
    data: {
      type: "item",
      item,
    },
  });

  const isRecipe = item.itemType === "recipe";

  // Prefetch recipe data when item enters viewport
  const prefetchRef = useRecipePrefetch(item.recipeId ?? "", isRecipe && !!item.recipeId);

  const handleClick = useCallback(() => {
    if (isRecipe && onRecipeClick) {
      onRecipeClick(item);
    } else if (!isRecipe && onNoteClick) {
      onNoteClick(item);
    }
  }, [isRecipe, item, onRecipeClick, onNoteClick]);

  const handleDoubleClick = useCallback(() => {
    if (isRecipe && item.recipeId) {
      router.push(`/recipes/${item.recipeId}`);
    }
  }, [isRecipe, item.recipeId, router]);

  const content = (
    <div
      ref={setNodeRef}
      className={`touch-pan-y py-1.5 ${isDragging ? "cursor-grabbing opacity-40" : "cursor-grab"}`}
      {...attributes}
      {...listeners}
    >
      <PlannedItemContent item={item} />
    </div>
  );

  // Wrap in button for click handling
  if (onRecipeClick || onNoteClick) {
    return (
      <div ref={prefetchRef}>
        <button
          className="block w-full text-left focus:outline-none"
          type="button"
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {content}
        </button>
      </div>
    );
  }

  return <div ref={prefetchRef}>{content}</div>;
});
