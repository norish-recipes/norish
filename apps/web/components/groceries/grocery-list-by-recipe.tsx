"use client";

import { useMemo } from "react";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import type { GroceryDto, RecurringGroceryDto, StoreDto } from "@norish/shared/contracts";

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
}

interface RecipeGroup {
  recipeId: string | null;
  recipeName: string;
  groceries: GroceryDto[];
}

export function GroceryListByRecipe({
  groceries,
  stores,
  recurringGroceries,
  recipeMap,
  onToggle,
  onEdit,
  onDelete,
  onReorder,
}: GroceryListByRecipeProps) {
  const t = useTranslations("groceries");

  // Group groceries by recipe
  const recipeGroups = useMemo(() => {
    const groups: Map<string | null, GroceryDto[]> = new Map();

    // Initialize with null for manual items
    groups.set(null, []);

    groceries.forEach((grocery) => {
      const recipeIngredientId = grocery.recipeIngredientId;
      const recipeInfo = recipeIngredientId ? recipeMap[recipeIngredientId] : null;
      const recipeId = recipeInfo?.recipeId ?? null;

      if (!groups.has(recipeId)) {
        groups.set(recipeId, []);
      }
      groups.get(recipeId)!.push(grocery);
    });

    // Convert to array of RecipeGroup
    const result: RecipeGroup[] = [];

    // Add manual items first (if present)
    const manualItems = groups.get(null) ?? [];

    if (manualItems.length > 0) {
      result.push({
        recipeId: null,
        recipeName: t("empty.manual"),
        groceries: manualItems,
      });
    }

    // Add recipe groups (sorted by recipe name)
    const recipeEntries: [string, GroceryDto[]][] = [];

    groups.forEach((groceries, recipeId) => {
      if (recipeId !== null && groceries.length > 0) {
        recipeEntries.push([recipeId, groceries]);
      }
    });

    // Sort by recipe name
    recipeEntries.sort((a, b) => {
      const nameA = getRecipeNameFromId(a[0], a[1], recipeMap);
      const nameB = getRecipeNameFromId(b[0], b[1], recipeMap);

      return nameA.localeCompare(nameB);
    });

    recipeEntries.forEach(([recipeId, groceries]) => {
      result.push({
        recipeId,
        recipeName: getRecipeNameFromId(recipeId, groceries, recipeMap),
        groceries,
      });
    });

    return result;
  }, [groceries, recipeMap, t]);

  // Check if there are any groceries
  const hasGroceries = groceries.length > 0;

  if (!hasGroceries) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="bg-content1/90 shadow-large relative w-full max-w-xl rounded-xl backdrop-blur-xl">
          <div className="flex flex-col items-center gap-6 p-10 text-center">
            <div className="relative">
              <div className="bg-primary-500/20 dark:bg-primary-400/15 absolute inset-0 scale-125 rounded-full blur-3xl" />
              <div className="bg-primary-500/15 text-primary-500 relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
                <ShoppingCartIcon className="h-7 w-7" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">{t("empty.title")}</h2>
              <p className="text-default-500 text-base">{t("empty.description")}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-1">
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

// Helper to get recipe name from recipeId using the recipeMap
function getRecipeNameFromId(
  recipeId: string,
  groceries: GroceryDto[],
  recipeMap: RecipeMap
): string {
  // Find the first grocery with this recipe's recipeIngredientId
  for (const grocery of groceries) {
    if (grocery.recipeIngredientId) {
      const info = recipeMap[grocery.recipeIngredientId];

      if (info?.recipeId === recipeId) {
        return info.recipeName;
      }
    }
  }

  return "Unknown Recipe";
}
