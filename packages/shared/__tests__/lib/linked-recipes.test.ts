import { describe, expect, it } from "vitest";

import type { LinkableRecipe } from "@norish/shared/lib/linked-recipes";
import {
  expandLinkedRecipes,
  extractLinkedRecipeIds,
  isOnlyRecipeLinks,
  linkedRecipeScaleFactor,
  MAX_LINKED_RECIPE_DEPTH,
  scaleIngredientAmounts,
  selectRowsForSystem,
} from "@norish/shared/lib/linked-recipes";

type Step = { step: string; systemUsed: string; order: number };
type Recipe = LinkableRecipe<Step>;

const link = (recipe: { id: string; name: string }) => `[${recipe.name}](id:${recipe.id})`;

function recipe(id: string, name: string, steps: string[], systemUsed = "metric"): Recipe {
  return {
    id,
    name,
    systemUsed,
    steps: steps.map((step, order) => ({ step, systemUsed, order })),
  };
}

function byId(...recipes: Recipe[]) {
  return new Map(recipes.map((r) => [r.id, r]));
}

/** The tree as text: each step, with linked recipes indented under it. */
function outline(nodes: ReturnType<typeof expandLinkedRecipes<Recipe, Step>>["steps"], depth = 0) {
  return nodes.flatMap((node): string[] => [
    `${"  ".repeat(depth)}${node.step.step}`,
    ...node.linked.flatMap((section) => [
      `${"  ".repeat(depth + 1)}> ${section.recipe.name}`,
      ...outline(section.steps, depth + 2),
    ]),
  ]);
}

const DOUGH = recipe("dough-1", "Pizza Dough", ["Mix the flour and water", "Knead for 10 minutes"]);
const SAUCE = recipe("sauce-1", "Tomato Sauce", ["Simmer the tomatoes"]);

describe("extractLinkedRecipeIds", () => {
  it("reads every linked recipe once, in the order they appear", () => {
    expect(
      extractLinkedRecipeIds(
        `Make ${link(DOUGH)}, then ${link(SAUCE)}, then knead ${link(DOUGH)} again`
      )
    ).toEqual(["dough-1", "sauce-1"]);
  });

  it("ignores ordinary links and empty text", () => {
    expect(extractLinkedRecipeIds("See [the video](https://example.com)")).toEqual([]);
    expect(extractLinkedRecipeIds("")).toEqual([]);
    expect(extractLinkedRecipeIds(null)).toEqual([]);
  });
});

describe("expandLinkedRecipes", () => {
  it("expands a linked recipe's steps right after the step that links it", () => {
    const pizza = recipe("pizza-1", "Pizza", [
      `Make the ${link(DOUGH)}`,
      "Stretch the dough",
      "Bake at 250 degrees",
    ]);

    const tree = expandLinkedRecipes(pizza, byId(DOUGH), { systemUsed: "metric" });

    expect(outline(tree.steps)).toEqual([
      `Make the ${link(DOUGH)}`,
      "  > Pizza Dough",
      "    Mix the flour and water",
      "    Knead for 10 minutes",
      "Stretch the dough",
      "Bake at 250 degrees",
    ]);
    expect(tree.sections.map((section) => [section.recipe.id, section.depth])).toEqual([
      ["dough-1", 1],
    ]);
    expect(tree.requestedIds).toEqual(["dough-1"]);
  });

  it("expands several recipes linked from one step in the order they are named", () => {
    const pizza = recipe("pizza-1", "Pizza", [`Prepare ${link(SAUCE)} and ${link(DOUGH)}`]);

    const tree = expandLinkedRecipes(pizza, byId(DOUGH, SAUCE), { systemUsed: "metric" });

    expect(tree.sections.map((section) => section.recipe.name)).toEqual([
      "Tomato Sauce",
      "Pizza Dough",
    ]);
  });

  it("expands a recipe only at its first link; later links stay links", () => {
    const pizza = recipe("pizza-1", "Pizza", [
      `Make the ${link(DOUGH)}`,
      `Knock back the ${link(DOUGH)}`,
    ]);

    const tree = expandLinkedRecipes(pizza, byId(DOUGH), { systemUsed: "metric" });

    expect(tree.steps[0]?.linked).toHaveLength(1);
    expect(tree.steps[1]?.linked).toEqual([]);
    expect(tree.sections).toHaveLength(1);
  });

  it("expands what a linked recipe links in turn, depth first", () => {
    const starter = recipe("starter-1", "Sourdough Starter", ["Feed the starter"]);
    const dough = recipe("dough-2", "Sourdough", [`Add the ${link(starter)}`, "Proof overnight"]);
    const pizza = recipe("pizza-1", "Pizza", [`Make the ${link(dough)}`, `Add ${link(SAUCE)}`]);

    const tree = expandLinkedRecipes(pizza, byId(starter, dough, SAUCE), {
      systemUsed: "metric",
    });

    expect(outline(tree.steps)).toEqual([
      `Make the ${link(dough)}`,
      "  > Sourdough",
      `    Add the ${link(starter)}`,
      "      > Sourdough Starter",
      "        Feed the starter",
      "    Proof overnight",
      `Add ${link(SAUCE)}`,
      "  > Tomato Sauce",
      "    Simmer the tomatoes",
    ]);
    // Reading order, with each recipe's depth.
    expect(tree.sections.map((section) => [section.recipe.name, section.depth])).toEqual([
      ["Sourdough", 1],
      ["Sourdough Starter", 2],
      ["Tomato Sauce", 1],
    ]);
  });

  it("never expands a recipe inside itself", () => {
    const pizza = recipe("pizza-1", "Pizza", ["Make another [Pizza](id:pizza-1)"]);

    const tree = expandLinkedRecipes(pizza, byId(pizza), { systemUsed: "metric" });

    expect(tree.sections).toEqual([]);
    expect(tree.requestedIds).toEqual([]);
  });

  it("ends a cycle at the link that would close it", () => {
    const a = recipe("a", "A", ["Make [B](id:b)"]);
    const b = recipe("b", "B", ["Make [A](id:a)", "Make [B](id:b)"]);

    const tree = expandLinkedRecipes(a, byId(a, b), { systemUsed: "metric" });

    expect(outline(tree.steps)).toEqual([
      "Make [B](id:b)",
      "  > B",
      "    Make [A](id:a)",
      "    Make [B](id:b)",
    ]);
  });

  it(`stops expanding below ${MAX_LINKED_RECIPE_DEPTH} levels`, () => {
    const chain = Array.from({ length: 6 }, (_, i) =>
      recipe(`r${i}`, `R${i}`, [i < 5 ? `Make [R${i + 1}](id:r${i + 1})` : "Done"])
    );

    const tree = expandLinkedRecipes(chain[0]!, byId(...chain), { systemUsed: "metric" });

    expect(tree.sections.map((section) => section.recipe.id)).toEqual(["r1", "r2", "r3"]);
    expect(tree.requestedIds).toEqual(["r1", "r2", "r3"]);
    expect(
      expandLinkedRecipes(chain[0]!, byId(...chain), { systemUsed: "metric", maxDepth: 1 }).sections
    ).toHaveLength(1);
  });

  it("asks for linked recipes that are not loaded and leaves them as links", () => {
    const pizza = recipe("pizza-1", "Pizza", [`Make ${link(DOUGH)}`, `Add ${link(SAUCE)}`]);

    const tree = expandLinkedRecipes(pizza, byId(SAUCE), { systemUsed: "metric" });

    expect(tree.requestedIds).toEqual(["dough-1", "sauce-1"]);
    expect(tree.steps[0]?.linked).toEqual([]);
    expect(tree.sections.map((section) => section.recipe.id)).toEqual(["sauce-1"]);
  });

  it("reads the recipe in its shown system, and linked recipes in it when they have it", () => {
    const dough: Recipe = {
      id: "dough-1",
      name: "Pizza Dough",
      systemUsed: "metric",
      steps: [
        { step: "Weigh 500 g flour", systemUsed: "metric", order: 0 },
        { step: "Measure 4 cups flour", systemUsed: "us", order: 0 },
      ],
    };
    const focaccia = recipe("foc-1", "Focaccia", ["Use 300 g flour"], "metric");
    const pizza: Recipe = {
      id: "pizza-1",
      name: "Pizza",
      systemUsed: "us",
      steps: [
        { step: `Make ${link(dough)} and ${link(focaccia)}`, systemUsed: "us", order: 0 },
        { step: `Metric twin ${link(dough)}`, systemUsed: "metric", order: 0 },
      ],
    };

    const tree = expandLinkedRecipes(pizza, byId(dough, focaccia), { systemUsed: "us" });

    expect(tree.steps.map((node) => node.step.step)).toEqual([
      `Make ${link(dough)} and ${link(focaccia)}`,
    ]);
    expect(
      tree.sections.map((section) => [
        section.recipe.name,
        section.systemUsed,
        section.steps.map((n) => n.step.step),
      ])
    ).toEqual([
      ["Pizza Dough", "us", ["Measure 4 cups flour"]],
      // Only stored in metric: shown in metric rather than not at all.
      ["Focaccia", "metric", ["Use 300 g flour"]],
    ]);
  });

  it("sorts steps by their order", () => {
    const dough: Recipe = {
      id: "dough-1",
      name: "Pizza Dough",
      systemUsed: "metric",
      steps: [
        { step: "Second", systemUsed: "metric", order: 1 },
        { step: "First", systemUsed: "metric", order: 0 },
      ],
    };
    const pizza = recipe("pizza-1", "Pizza", [`Make ${link(dough)}`]);

    const tree = expandLinkedRecipes(pizza, byId(dough), { systemUsed: "metric" });

    expect(tree.sections[0]?.steps.map((node) => node.step.step)).toEqual(["First", "Second"]);
  });

  it("expands nothing for a recipe without links or steps", () => {
    const plain = recipe("plain-1", "Toast", ["Toast the bread"]);
    const empty: Recipe = { id: "empty", name: "Empty", steps: null };

    expect(expandLinkedRecipes(plain, byId(), { systemUsed: "metric" })).toMatchObject({
      sections: [],
      requestedIds: [],
    });
    expect(expandLinkedRecipes(empty, byId(), { systemUsed: "metric" }).steps).toEqual([]);
  });
});

describe("isOnlyRecipeLinks", () => {
  it("is true for a text of links, whitespace and punctuation only", () => {
    expect(isOnlyRecipeLinks(link(DOUGH))).toBe(true);
    expect(isOnlyRecipeLinks(`  ${link(DOUGH)}.  `)).toBe(true);
    expect(isOnlyRecipeLinks(`${link(DOUGH)}, ${link(SAUCE)}`)).toBe(true);
  });

  it("is false once the text has words of its own, or no recipe link", () => {
    expect(isOnlyRecipeLinks(`Make the ${link(DOUGH)}`)).toBe(false);
    expect(isOnlyRecipeLinks(`${link(DOUGH)} and ${link(SAUCE)}`)).toBe(false);
    expect(isOnlyRecipeLinks("[a video](https://example.com)")).toBe(false);
    expect(isOnlyRecipeLinks("")).toBe(false);
    expect(isOnlyRecipeLinks(null)).toBe(false);
  });

  it("gives the same answer however often it is asked", () => {
    expect([1, 2, 3].map(() => isOnlyRecipeLinks(link(DOUGH)))).toEqual([true, true, true]);
  });
});

describe("steps replaced by the linked recipes they name", () => {
  const replacedSteps = (root: Recipe, ...loaded: Recipe[]) =>
    expandLinkedRecipes(root, byId(...loaded), { systemUsed: "metric" })
      .steps.filter((node) => node.replacedByLinked)
      .map((node) => node.step.step);

  it("marks a step that is only the link to a recipe expanding after it", () => {
    const pizza = recipe("pizza-1", "Pizza", [link(DOUGH), "Bake"]);

    expect(replacedSteps(pizza, DOUGH)).toEqual([link(DOUGH)]);
  });

  it("marks a step of several links when every one expands after it", () => {
    const pizza = recipe("pizza-1", "Pizza", [`${link(DOUGH)}, ${link(SAUCE)}`]);

    expect(replacedSteps(pizza, DOUGH, SAUCE)).toHaveLength(1);
    // One of the two not loaded: the step is all the reader has of it.
    expect(replacedSteps(pizza, DOUGH)).toEqual([]);
  });

  it("keeps a step with words of its own", () => {
    const pizza = recipe("pizza-1", "Pizza", [`Make the ${link(DOUGH)} and let it rest`]);

    expect(replacedSteps(pizza, DOUGH)).toEqual([]);
  });

  it("keeps the link while its recipe is not available", () => {
    const pizza = recipe("pizza-1", "Pizza", [link(DOUGH)]);

    expect(replacedSteps(pizza)).toEqual([]);
  });

  it("keeps a later link to a recipe that expanded earlier", () => {
    const pizza = recipe("pizza-1", "Pizza", [link(DOUGH), link(DOUGH)]);
    const tree = expandLinkedRecipes(pizza, byId(DOUGH), { systemUsed: "metric" });

    expect(tree.steps.map((node) => node.replacedByLinked)).toEqual([true, false]);
  });

  it("keeps a heading row that names a recipe", () => {
    const pizza = recipe("pizza-1", "Pizza", [`# ${link(DOUGH)}`]);

    expect(replacedSteps(pizza, DOUGH)).toEqual([]);
  });

  it("marks link-only steps inside a linked recipe too", () => {
    const starter = recipe("starter-1", "Starter", ["Feed it"]);
    const dough = recipe("dough-2", "Dough", [link(starter), "Knead"]);
    const pizza = recipe("pizza-1", "Pizza", [link(dough)]);
    const tree = expandLinkedRecipes(pizza, byId(starter, dough), { systemUsed: "metric" });

    expect(tree.sections[0]?.steps.map((node) => node.replacedByLinked)).toEqual([true, false]);
  });
});

describe("selectRowsForSystem", () => {
  const rows = [
    { name: "flour", systemUsed: "metric" },
    { name: "flour", systemUsed: "us" },
  ];

  it("prefers the requested system, then the recipe's own, then any", () => {
    expect(selectRowsForSystem(rows, "us", "metric")).toEqual([rows[1]]);
    expect(selectRowsForSystem([rows[0]!], "us", "metric")).toEqual([rows[0]]);
    expect(selectRowsForSystem([rows[1]!], null, "metric")).toEqual([rows[1]]);
    expect(selectRowsForSystem([], "us", "metric")).toEqual([]);
  });
});

describe("scaleIngredientAmounts", () => {
  const lines = [
    { ingredientName: "flour", amount: 500 },
    { ingredientName: "water", amount: "325" },
    { ingredientName: "salt", amount: null },
    { ingredientName: "# Topping", amount: "" },
    { ingredientName: "pinch", amount: 0 },
  ];

  it("scales numeric amounts and leaves the rest", () => {
    expect(scaleIngredientAmounts(lines, 1 / 3).map((line) => line.amount)).toEqual([
      166.6667,
      108.3333,
      null,
      "",
      0,
    ]);
  });

  it("returns the lines untouched at factor one or a meaningless factor", () => {
    expect(scaleIngredientAmounts(lines, 1)).toBe(lines);
    expect(scaleIngredientAmounts(lines, 0)).toBe(lines);
    expect(scaleIngredientAmounts(lines, Number.NaN)).toBe(lines);
  });
});

describe("linkedRecipeScaleFactor", () => {
  it("follows the servings the reader chose", () => {
    expect(linkedRecipeScaleFactor(4, 8)).toBe(2);
    expect(linkedRecipeScaleFactor(4, 2)).toBe(0.5);
    expect(linkedRecipeScaleFactor(4, 4)).toBe(1);
  });

  it("is one when servings are unknown", () => {
    expect(linkedRecipeScaleFactor(0, 4)).toBe(1);
    expect(linkedRecipeScaleFactor(null, 4)).toBe(1);
    expect(linkedRecipeScaleFactor(4, undefined)).toBe(1);
  });
});
