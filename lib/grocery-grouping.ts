import type { GroceryDto } from "@/types";
import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { parseIngredientWithDefaults } from "./helpers";

/**
 * Client-side grocery grouping for combining identical ingredients in store view.
 * Groups by exact normalized name within each store, aggregates amounts when units match.
 */

/**
 * Normalize ingredient name: lowercase, strip qualifiers like (diced), [optional].
 */
export function normalizeIngredientNameForGrouping(name: string | null): string {
  if (!name) return "";

  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s*\{[^}]*\}\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Normalize unit using parseIngredientWithDefaults to get canonical unit ID.
 * Falls back to lowercase if unit not recognized.
 */
export function normalizeUnitForGrouping(unit: string | null, customUnits?: UnitsMap): string {
  if (!unit) return "";

  const trimmed = unit.trim();

  if (!trimmed) return "";

  try {
    const parsed = parseIngredientWithDefaults(`1 ${trimmed} item`, customUnits);

    if (parsed[0]?.unitOfMeasureID) {
      return parsed[0].unitOfMeasureID;
    }
  } catch {
    // Fall through
  }

  return trimmed.toLowerCase();
}

export interface GroupedGrocerySource {
  grocery: GroceryDto;
  recipeName: string | null;
}

export interface GroceryGroup {
  groupKey: string;
  displayName: string;
  normalizedName: string;
  normalizedUnit: string;
  storeId: string | null;
  totalAmount: number | null;
  displayUnit: string | null;
  canAggregate: boolean;
  sources: GroupedGrocerySource[];
  allDone: boolean;
  anyDone: boolean;
  primaryId: string;
}

/**
 * Group groceries by exact normalized name within each store.
 */
export function groupGroceriesByIngredient(
  groceries: GroceryDto[],
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null,
  customUnits?: UnitsMap
): Map<string | null, GroceryGroup[]> {
  const storeGroceries = new Map<string | null, GroceryDto[]>();

  for (const grocery of groceries) {
    const storeId = grocery.storeId;

    if (!storeGroceries.has(storeId)) {
      storeGroceries.set(storeId, []);
    }
    storeGroceries.get(storeId)!.push(grocery);
  }

  const result = new Map<string | null, GroceryGroup[]>();

  for (const [storeId, storeItems] of storeGroceries) {
    // Group by exact normalized name
    const nameGroups = new Map<string, GroceryDto[]>();

    for (const grocery of storeItems) {
      const normalizedName = normalizeIngredientNameForGrouping(grocery.name);

      if (!normalizedName) continue;

      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, []);
      }
      nameGroups.get(normalizedName)!.push(grocery);
    }

    const groups: GroceryGroup[] = [];

    for (const [normalizedName, items] of nameGroups) {
      const sortedItems = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      const normalizedUnits = sortedItems.map((g) => normalizeUnitForGrouping(g.unit, customUnits));
      const uniqueUnits = new Set(normalizedUnits.filter((u) => u !== ""));
      const canAggregate = uniqueUnits.size <= 1;

      let totalAmount: number | null = null;
      let displayUnit: string | null = null;

      if (canAggregate && uniqueUnits.size === 1) {
        displayUnit = [...uniqueUnits][0];
        totalAmount = sortedItems.reduce((sum, g) => sum + (g.amount ?? 1), 0);
      } else if (canAggregate && uniqueUnits.size === 0) {
        totalAmount = sortedItems.reduce((sum, g) => sum + (g.amount ?? 1), 0);
        displayUnit = null;
      }

      const sources: GroupedGrocerySource[] = sortedItems.map((grocery) => ({
        grocery,
        recipeName: getRecipeNameForGrocery(grocery),
      }));

      const firstItem = sortedItems[0];
      const displayName = getDisplayName(firstItem.name);

      const allDone = sortedItems.every((g) => g.isDone);
      const anyDone = sortedItems.some((g) => g.isDone);

      const groupKey = `${storeId ?? "unsorted"}|${normalizedName}|${displayUnit ?? "count"}`;

      groups.push({
        groupKey,
        displayName,
        normalizedName,
        normalizedUnit: displayUnit ?? "",
        storeId,
        totalAmount,
        displayUnit,
        canAggregate,
        sources,
        allDone,
        anyDone,
        primaryId: firstItem.id,
      });
    }

    groups.sort((a, b) => {
      const aOrder = a.sources[0]?.grocery.sortOrder ?? 0;
      const bOrder = b.sources[0]?.grocery.sortOrder ?? 0;

      return aOrder - bOrder;
    });

    result.set(storeId, groups);
  }

  return result;
}

function getDisplayName(name: string | null): string {
  if (!name) return "Unknown item";

  return (
    name
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s*\[[^\]]*\]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Unknown item"
  );
}

export function hasGroupableItems(groceries: GroceryDto[], storeId: string | null): boolean {
  const storeGroceries = groceries.filter((g) => g.storeId === storeId);
  const names = storeGroceries.map((g) => normalizeIngredientNameForGrouping(g.name));
  const uniqueNames = new Set(names.filter((n) => n !== ""));

  return uniqueNames.size < storeGroceries.length;
}
