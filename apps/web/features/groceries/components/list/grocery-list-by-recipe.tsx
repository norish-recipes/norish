"use client";

import { EmptyStateCard } from "@/components/shared/empty-state";
import { listFoodIds } from "@/features/groceries/lib/list-food-ids";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";
import { groupGroceriesByRecipe } from "@norish/shared-react/groceries";
import { useIngredientIcons } from "@norish/shared-react/ingredients";

import { RecipeSection } from "./recipe-section";

interface RecipeInfo {
  recipeId: string;
  recipeName: string;
}

type RecipeMap = Record<string, RecipeInfo>;

interface GroceryListByRecipeProps {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  onToggle: (id: string, isDone: boolean) => void;
  onEdit: (grocery: GroceryDto) => void;
  onDelete: (id: string) => void;
  onReorder?: (updates: { id: string; sortOrder: number }[]) => void;
  onClearRecipe?: (ids: string[], name: string) => void;
}

/** The list by recipe, under one read of the icons of every food on it. */
export function GroceryListByRecipe(props: GroceryListByRecipeProps) {
  useIngredientIcons(listFoodIds(props));

  return <GroceryListByRecipeContent {...props} />;
}

function GroceryListByRecipeContent({
  groceries,
  stores,
  recurringGroceries,
  recipeMap,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
  onClearRecipe,
}: GroceryListByRecipeProps) {
  const t = useTranslations("groceries");

  const recipeGroups = groupGroceriesByRecipe(groceries, recipeMap, t("empty.manual"));

  // Check if there are any groceries
  const hasGroceries = groceries.length > 0;

  if (!hasGroceries) {
    return (
      <div className="px-4 py-20">
        <EmptyStateCard
          className="mx-auto w-full max-w-xl"
          icon={ShoppingCartIcon}
          title={t("empty.title")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      {recipeGroups.map((group) => (
        <motion.div
          key={group.recipeId ?? "manual"}
          layout
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        >
          <RecipeSection
            groceries={group.groceries}
            recipeId={group.recipeId}
            recipeName={group.recipeName}
            recurringGroceries={recurringGroceries}
            stores={stores}
            onClearRecipe={() =>
              onClearRecipe?.(
                group.groceries.map((g) => g.id),
                group.recipeName
              )
            }
            onDelete={onDelete}
            onEdit={onEdit}
            onReorder={onReorder}
            onToggle={onToggle}
          />
        </motion.div>
      ))}
    </div>
  );
}
