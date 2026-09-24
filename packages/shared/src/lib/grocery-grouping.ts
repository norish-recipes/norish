import type { UnitsMap } from "@norish/config/zod/server-config";
import type { GroceryDto } from "@norish/shared/contracts";

import { parseIngredientWithDefaults } from "./helpers";

/**
 * Client-side grocery grouping for combining identical ingredients in store view.
 * A group is one name measured one way, within one store and one aisle, so the
 * amounts under it always add up to something the shopper asked for.
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
  /** The canonical unit every source is measured in; "" when they are measured in none. */
  normalizedUnit: string;
  storeId: string | null;
  /** The aisle its Store files the group's name under, or null: groups are per aisle per Store (ADR-0031). */
  aisleId: string | null;
  totalAmount: number;
  displayUnit: string | null;
  sources: GroupedGrocerySource[];
  allDone: boolean;
  anyDone: boolean;
  primaryId: string;
}

const noAisle = (): string | null => null;

/**
 * Group groceries by exact normalized name and unit within each store — and
 * within each aisle: a group never straddles aisles, so "kip" filed in Vlees
 * and "kip (diepvries)" filed in Diepvries are two groups even though they
 * fold to one grouping name (ADR-0031). `aisleOf` answers with the aisle a
 * Store files a grocery's own name under, or null.
 *
 * The unit is part of what makes a group because a group states one total:
 * 300 g heavy cream and a heavy cream with no measure are two things to buy,
 * and "301 g" is a quantity neither line asked for.
 */
export function groupGroceriesByIngredient(
  groceries: GroceryDto[],
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null,
  customUnits?: UnitsMap,
  aisleOf: (grocery: GroceryDto) => string | null = noAisle
): Map<string | null, GroceryGroup[]> {
  const storeGroceries = new Map<string | null, GroceryDto[]>();

  for (const grocery of groceries) {
    const storeId = grocery.storeId ?? null;

    if (!storeGroceries.has(storeId)) {
      storeGroceries.set(storeId, []);
    }
    storeGroceries.get(storeId)!.push(grocery);
  }

  const result = new Map<string | null, GroceryGroup[]>();

  for (const [storeId, storeItems] of storeGroceries) {
    // Group by exact normalized name and unit, per aisle
    const nameGroups = new Map<
      string,
      {
        aisleId: string | null;
        normalizedName: string;
        normalizedUnit: string;
        items: GroceryDto[];
      }
    >();

    for (const grocery of storeItems) {
      const normalizedName = normalizeIngredientNameForGrouping(grocery.name);

      if (!normalizedName) continue;
      const aisleId = aisleOf(grocery);
      // Grams and gram are one measure, so they still group; grams and
      // nothing at all are not.
      const normalizedUnit = normalizeUnitForGrouping(grocery.unit, customUnits);
      const key = `${aisleId ?? ""}|${normalizedName}|${normalizedUnit}`;

      if (!nameGroups.has(key)) {
        nameGroups.set(key, { aisleId, normalizedName, normalizedUnit, items: [] });
      }
      nameGroups.get(key)!.items.push(grocery);
    }

    const groups: GroceryGroup[] = [];

    for (const { aisleId, normalizedName, normalizedUnit, items } of nameGroups.values()) {
      const sortedItems = [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      // One unit, so one total; a line that states no amount stands for one of
      // whatever its group counts.
      const totalAmount = sortedItems.reduce((sum, g) => sum + (g.amount ?? 1), 0);
      const displayUnit = normalizedUnit || null;

      const sources: GroupedGrocerySource[] = sortedItems.map((grocery) => ({
        grocery,
        recipeName: getRecipeNameForGrocery(grocery),
      }));

      const firstItem = sortedItems[0];

      if (!firstItem) {
        continue;
      }

      const displayName = getDisplayName(firstItem.name);

      const allDone = sortedItems.every((g) => g.isDone);
      const anyDone = sortedItems.some((g) => g.isDone);

      const groupKey = `${storeId ?? "unsorted"}|${aisleId ?? ""}|${normalizedName}|${normalizedUnit || "count"}`;

      groups.push({
        groupKey,
        displayName,
        normalizedName,
        normalizedUnit,
        storeId,
        aisleId,
        totalAmount,
        displayUnit,
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
