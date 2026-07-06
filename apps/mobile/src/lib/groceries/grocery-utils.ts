import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import type { RecipeMap } from "@norish/shared-react/hooks";

export type GrocerySection = {
  id: string;
  title: string;
  tintColor: string;
  items: GroceryDto[];
};

// TODO: This needs cleaning up when both heroui apps are on v3.
export const STORE_COLOR_TINTS: Record<string, string> = {
  primary: "#0EA5E9",
  secondary: "#8B5CF6",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#FB7185",
  slate: "#64748B",
  sky: "#0EA5E9",
  violet: "#8B5CF6",
};

const UNSORTED_SECTION = {
  id: "unsorted",
  title: "Unsorted",
  tintColor: "#8B5CF6",
};

export function formatAmountUnit(amount: number | null, unit: string | null): string {
  if (amount == null && !unit) return "1";
  if (amount == null) return unit ?? "1";

  const formattedAmount = Number.isInteger(amount)
    ? String(amount)
    : String(amount).replace(/0+$/, "").replace(/\.$/, "");

  return [formattedAmount, unit].filter(Boolean).join(" ");
}

export function storeTintColor(store: StoreDto): string {
  return STORE_COLOR_TINTS[store.color] ?? STORE_COLOR_TINTS.primary;
}

function groceryRecipeId(grocery: GroceryDto, recipeMap: RecipeMap): string | null {
  if (!grocery.recipeIngredientId) return null;
  return recipeMap[grocery.recipeIngredientId]?.recipeId ?? null;
}

/**
 * Pending items first, completed items at the bottom.
 * Items in `frozenIds` are treated as not-yet-completed so their position stays pinned.
 */
export function sortByCompletion(
  items: GroceryDto[],
  frozenIds: ReadonlySet<string> = new Set()
): GroceryDto[] {
  return [...items].sort((a, b) => {
    const aDone = a.isDone && !frozenIds.has(a.id);
    const bDone = b.isDone && !frozenIds.has(b.id);

    if (aDone !== bDone) return Number(aDone) - Number(bDone);

    const aOrder = a.sortOrder ?? Infinity;
    const bOrder = b.sortOrder ?? Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return (a.name ?? "").localeCompare(b.name ?? "");
  });
}

/** Split a section's items into sortable (uncompleted) and done (completed) arrays. */
export function splitSectionItems(
  items: GroceryDto[],
  frozenIds: ReadonlySet<string> = new Set()
): { sortableItems: GroceryDto[]; doneItems: GroceryDto[] } {
  const sortableItems: GroceryDto[] = [];
  const doneItems: GroceryDto[] = [];

  for (const item of items) {
    if (item.isDone && !frozenIds.has(item.id)) {
      doneItems.push(item);
    } else {
      sortableItems.push(item);
    }
  }

  return { sortableItems, doneItems };
}

export function buildStoreSections({
  groceries,
  stores,
  frozenIds = new Set(),
}: {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recipeMap: RecipeMap;
  frozenIds?: ReadonlySet<string>;
}): GrocerySection[] {
  const sections: GrocerySection[] = [];
  const unsortedItems = groceries.filter((item) => item.storeId == null);

  if (unsortedItems.length > 0) {
    sections.push({
      ...UNSORTED_SECTION,
      items: sortByCompletion(unsortedItems, frozenIds),
    });
  }

  for (const store of stores.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    const storeItems = groceries.filter((item) => item.storeId === store.id);
    if (storeItems.length === 0) continue;

    sections.push({
      id: store.id,
      title: store.name,
      tintColor: storeTintColor(store),
      items: sortByCompletion(storeItems, frozenIds),
    });
  }

  return sections;
}

export function buildRecipeSections({
  groceries,
  recipeMap,
  frozenIds = new Set(),
}: {
  groceries: GroceryDto[];
  stores: StoreDto[];
  recipeMap: RecipeMap;
  frozenIds?: ReadonlySet<string>;
}): GrocerySection[] {
  const recipeEntries = Object.values(recipeMap).sort((a, b) =>
    a.recipeName.localeCompare(b.recipeName)
  );
  const seenRecipeIds = new Set<string>();
  const sections: GrocerySection[] = [];

  for (const recipe of recipeEntries) {
    if (seenRecipeIds.has(recipe.recipeId)) continue;
    seenRecipeIds.add(recipe.recipeId);

    const recipeItems = groceries.filter(
      (item) => groceryRecipeId(item, recipeMap) === recipe.recipeId
    );
    if (recipeItems.length === 0) continue;

    sections.push({
      id: recipe.recipeId,
      title: recipe.recipeName,
      tintColor: "#0EA5E9",
      items: sortByCompletion(recipeItems, frozenIds),
    });
  }

  const uncategorizedItems = groceries.filter((item) => groceryRecipeId(item, recipeMap) == null);

  if (uncategorizedItems.length > 0) {
    sections.push({
      id: "recipe-free",
      title: "Just groceries",
      tintColor: "#A855F7",
      items: sortByCompletion(uncategorizedItems, frozenIds),
    });
  }

  return sections;
}
