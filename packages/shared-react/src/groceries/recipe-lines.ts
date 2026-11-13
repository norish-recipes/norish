import type { LineWithFoods } from "@norish/shared/lib/line-foods";

/** A recipe's ingredient line as the groceries panel reads it. */
export type GroceryIngredient = LineWithFoods & {
  id: string;
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

/** A line as the person edited it in the panel: only text, matched to a food by its name. */
export type EditedIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
};

/** The ids of the recipes a set of lines links to, each once. */
export function extractLinkedRecipeIds(ingredients: GroceryIngredient[]) {
  const ids = new Set<string>();

  for (const ingredient of ingredients) {
    const name = ingredient.ingredientName ?? "";

    for (const match of name.matchAll(/\[[^[\]]+\]\(id:([a-zA-Z0-9-]+)\)/g)) {
      if (match[1]) ids.add(match[1]);
    }
  }

  return Array.from(ids);
}

/** Whether a line names a food: not a heading, not a link to a recipe, not a tool. */
export function isGroceryIngredient(ingredient: GroceryIngredient) {
  const name = ingredient.ingredientName?.trim() ?? "";

  return !name.startsWith("#") && !name.includes("(id:") && name && ingredient.ingredientId;
}

function parseAmountToken(token: string | undefined) {
  if (!token) return null;

  if (/^\d+\/\d+$/.test(token)) {
    const [numerator, denominator] = token.split("/").map(Number);

    return denominator ? numerator! / denominator : null;
  }

  const value = Number(token);

  return Number.isFinite(value) ? value : null;
}

/** An edited line's text back into amount, unit and name; what it does not say stays the line's. */
export function parseEditedIngredientLine(
  value: string,
  fallback: GroceryIngredient
): EditedIngredient {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstAmount = parseAmountToken(parts[0]);
  let amount: number | null = fallback.amount ?? null;
  let unit: string | null = fallback.unit ?? null;
  let nameStart = 0;

  if (firstAmount !== null) {
    amount = firstAmount;
    nameStart = 1;

    const mixedFraction = parseAmountToken(parts[1]);

    if (mixedFraction !== null && parts[1]?.includes("/")) {
      amount += mixedFraction;
      nameStart = 2;
    }

    if (fallback.unit && parts[nameStart]) {
      unit = parts[nameStart] ?? null;
      nameStart += 1;
    }
  }

  const name = parts.slice(nameStart).join(" ").trim() || fallback.ingredientName;

  return { amount, unit, name };
}

/** A line as the text field starts from: amount, unit and name. */
export function formatEditableIngredient(item: GroceryIngredient) {
  return [item.amount, item.unit, item.ingredientName].filter(Boolean).join(" ");
}
