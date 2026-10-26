/**
 * Linked Recipes: a step that names another recipe with `/` (stored as
 * `[Name](id:<recipe id>)`) brings that recipe along. The reader sees its
 * steps right after the step that links it, under a header naming the recipe,
 * and its ingredients beside the recipe's own — a pizza that links its dough
 * is cooked and shopped for as one dish.
 *
 * Everything here is derived at display time from the recipes as they stand;
 * nothing about a link's expansion is stored.
 *
 * - Each linked recipe expands once, at the first step that links it; a later
 *   link to the same recipe stays a plain link ("knock back the dough").
 * - A recipe never expands inside itself, so a cycle (A links B links A) ends
 *   at the link that would close it.
 * - Links inside a linked recipe expand too, down to `MAX_LINKED_RECIPE_DEPTH`.
 */

const RECIPE_LINK_PATTERN = /\[[^\]]+\]\(id:([a-zA-Z0-9-]+)\)/g;

/** How many levels of linked recipes expand: the dough's own linked starter is 2. */
export const MAX_LINKED_RECIPE_DEPTH = 3;

export interface LinkableStep {
  step: string;
  systemUsed: string;
  order: number;
}

export interface LinkableRecipe<TStep extends LinkableStep = LinkableStep> {
  id: string;
  name: string;
  systemUsed?: string | null;
  steps?: TStep[] | null;
}

/** One linked recipe as it reads inside another: its steps, in its chosen system. */
export interface LinkedRecipeSection<
  TRecipe extends LinkableRecipe<TStep>,
  TStep extends LinkableStep = LinkableStep,
> {
  recipe: TRecipe;
  /** The measurement system its rows were read in. */
  systemUsed: string;
  /** 1 for a recipe linked from the recipe being read, 2 for one linked from that, … */
  depth: number;
  steps: LinkedRecipeStepNode<TRecipe, TStep>[];
}

/** A step, and the linked recipes that expand right after it. */
export interface LinkedRecipeStepNode<
  TRecipe extends LinkableRecipe<TStep>,
  TStep extends LinkableStep = LinkableStep,
> {
  step: TStep;
  linked: LinkedRecipeSection<TRecipe, TStep>[];
  /**
   * The step says nothing but the links that expand right after it ("[Garlic
   * Aioli]"), so the sections' headers say all it did and it need not be
   * shown on its own. A step with words of its own ("Make the [Dough] and let
   * it rest") is always kept.
   */
  replacedByLinked: boolean;
}

export interface LinkedRecipeTree<
  TRecipe extends LinkableRecipe<TStep>,
  TStep extends LinkableStep = LinkableStep,
> {
  /** The recipe being read's own steps, in `systemUsed`, each with its expansions. */
  steps: LinkedRecipeStepNode<TRecipe, TStep>[];
  /** Every linked recipe that expanded, in reading order. */
  sections: LinkedRecipeSection<TRecipe, TStep>[];
  /**
   * Every recipe the expansion reached for, loaded or not: what a reader
   * needs fetched for the tree to be complete. A recipe that is not loaded
   * (still on its way, deleted, or not visible to the reader) simply does
   * not expand — its link still reads as a link.
   */
  requestedIds: string[];
}

export interface ExpandLinkedRecipesOptions {
  /** The system the recipe being read is shown in; linked recipes prefer it too. */
  systemUsed: string;
  maxDepth?: number;
}

/**
 * Whether a text is only recipe links: nothing left once the links,
 * whitespace and punctuation are taken out.
 */
export function isOnlyRecipeLinks(text: string | null | undefined): boolean {
  if (!text || extractLinkedRecipeIds(text).length === 0) return false;

  return text.replace(RECIPE_LINK_PATTERN, "").replace(/[\s\p{P}]/gu, "") === "";
}

/** The recipe ids a text links, once each, in the order they appear. */
export function extractLinkedRecipeIds(text: string | null | undefined): string[] {
  if (!text) return [];

  const ids: string[] = [];

  for (const match of text.matchAll(RECIPE_LINK_PATTERN)) {
    const id = match[1];

    if (id && !ids.includes(id)) ids.push(id);
  }

  return ids;
}

/**
 * Rows (steps or ingredient lines) are stored once per measurement system.
 * Pick the preferred system when the rows have it, otherwise the recipe's own
 * system, otherwise whichever system the rows actually use.
 */
export function selectRowsForSystem<T extends { systemUsed: string }>(
  rows: T[],
  preferredSystem: string | null | undefined,
  ownSystem: string | null | undefined
): T[] {
  for (const system of [preferredSystem, ownSystem, rows[0]?.systemUsed]) {
    if (!system) continue;

    const matches = rows.filter((row) => row.systemUsed === system);

    if (matches.length > 0) return matches;
  }

  return [];
}

function sortedStepsInSystem<TStep extends LinkableStep>(steps: TStep[], systemUsed: string) {
  return steps.filter((step) => step.systemUsed === systemUsed).sort((a, b) => a.order - b.order);
}

/**
 * The recipe being read, with every linked recipe it reaches expanded after
 * the step that first links it. `recipesById` holds whichever linked recipes
 * are loaded; the rest are reported in `requestedIds` and left as links.
 */
export function expandLinkedRecipes<
  TRecipe extends LinkableRecipe<TStep>,
  TStep extends LinkableStep = LinkableStep,
>(
  root: TRecipe,
  recipesById: ReadonlyMap<string, TRecipe>,
  { systemUsed, maxDepth = MAX_LINKED_RECIPE_DEPTH }: ExpandLinkedRecipesOptions
): LinkedRecipeTree<TRecipe, TStep> {
  // Claimed in reading order, so the first link to a recipe is where it expands.
  const claimed = new Set<string>([root.id]);
  const requestedIds: string[] = [];
  const sections: LinkedRecipeSection<TRecipe, TStep>[] = [];

  const expandSteps = (steps: TStep[], depth: number): LinkedRecipeStepNode<TRecipe, TStep>[] =>
    steps.map((step) => {
      const linked: LinkedRecipeSection<TRecipe, TStep>[] = [];

      if (depth < maxDepth) {
        for (const id of extractLinkedRecipeIds(step.step)) {
          if (claimed.has(id)) continue;

          claimed.add(id);
          requestedIds.push(id);

          const recipe = recipesById.get(id);

          if (!recipe) continue;

          const sectionSystem =
            selectRowsForSystem(recipe.steps ?? [], systemUsed, recipe.systemUsed)[0]?.systemUsed ??
            recipe.systemUsed ??
            systemUsed;
          const section: LinkedRecipeSection<TRecipe, TStep> = {
            recipe,
            systemUsed: sectionSystem,
            depth: depth + 1,
            steps: [],
          };

          // Pushed before its own steps expand, so sections stay in reading order.
          sections.push(section);
          section.steps = expandSteps(
            sortedStepsInSystem(recipe.steps ?? [], sectionSystem),
            depth + 1
          );
          linked.push(section);
        }
      }

      const text = step.step.trim();
      const replacedByLinked =
        linked.length > 0 &&
        !text.startsWith("#") &&
        isOnlyRecipeLinks(text) &&
        extractLinkedRecipeIds(text).every((id) =>
          linked.some((section) => section.recipe.id === id)
        );

      return { step, linked, replacedByLinked };
    });

  const steps = expandSteps(sortedStepsInSystem(root.steps ?? [], systemUsed), 0);

  return { steps, sections, requestedIds };
}

/**
 * Amounts scaled by `factor`, the way the servings control scales the recipe's
 * own lines: to four decimals, leaving amountless and non-numeric lines alone.
 */
export function scaleIngredientAmounts<T extends { amount?: number | string | null }>(
  lines: T[],
  factor: number
): T[] {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return lines;

  return lines.map((line) => {
    if (line.amount == null || line.amount === "") return line;

    const amount = Number(line.amount);

    if (!Number.isFinite(amount) || amount <= 0) return line;

    return { ...line, amount: Math.round(amount * factor * 10000) / 10000 };
  });
}

/**
 * How much the linked recipes scale with the recipe being read: one batch of
 * dough at the recipe's own servings, two when the reader doubles it.
 */
export function linkedRecipeScaleFactor(
  servings: number | null | undefined,
  currentServings: number | null | undefined
): number {
  if (!servings || servings <= 0 || !currentServings || currentServings <= 0) return 1;

  return currentServings / servings;
}
