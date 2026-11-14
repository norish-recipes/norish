/** A `#` line in the ingredients or steps titles the lines under it. */
const headingText = (text: string) => {
  const trimmed = text.trim();

  return trimmed.startsWith("#") ? trimmed.replace(/^#+\s*/, "") : null;
};

type Ingredient = { ingredientName: string; systemUsed: string; order: number };
type Step = { step: string; systemUsed: string; order: number };

export type IngredientRow<T extends Ingredient> =
  | { kind: "heading"; key: number; text: string }
  | { kind: "line"; key: number; index: number; line: T };

/** The recipe's lines in its own measurement system, in order; headings carry no index. */
export function ingredientRows<T extends Ingredient>(
  ingredients: readonly T[],
  systemUsed: string
): IngredientRow<T>[] {
  let index = 0;

  return ingredients
    .filter((line) => line.systemUsed === systemUsed)
    .sort((a, b) => a.order - b.order)
    .map((line) => {
      const heading = headingText(line.ingredientName);

      return heading === null
        ? { kind: "line", key: line.order, index: index++, line }
        : { kind: "heading", key: line.order, text: heading };
    });
}

export type StepRow<T extends Step> =
  | { kind: "heading"; key: number; text: string }
  | { kind: "step"; key: number; number: number; step: T };

/** The steps in the recipe's measurement system, numbered with headings taking no number. */
export function stepRows<T extends Step>(steps: readonly T[], systemUsed: string): StepRow<T>[] {
  let number = 0;

  return steps
    .filter((step) => step.systemUsed === systemUsed)
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const heading = headingText(step.step);

      return heading === null
        ? { kind: "step", key: step.order, number: ++number, step }
        : { kind: "heading", key: step.order, text: heading };
    });
}

/** Markdown as plain text: links keep their label, emphasis and heading marks go. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]{0,200}\]\([^)]{0,500}\)/g, "")
    .replace(/\[([^\]]{0,200})\]\([^)]{0,500}\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#+\s*/gm, "")
    .trim();
}
