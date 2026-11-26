import { describe, expect, it } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import type { RecipeFormState } from "../recipe-editor";
import {
  detectFormSystem,
  editorIngredientsOf,
  editorStepsOf,
  initialRecipeForm,
  isRecipeFormDirty,
  rebaseRecipeForm,
  recipeFormPayload,
  validateRecipeForm,
} from "../recipe-editor";
import {
  hasIngredientContent,
  ingredientRowsToLines,
  ingredientSuggestionsOf,
  ingredientTriggerAt,
  lineMoves,
  matchIngredientSuggestions,
  mentionIngredient,
  normalizeIngredientRows,
  recipeTriggerAt,
  remapStepRefs,
  removeIngredientRow,
  replaceTrigger,
  rowNumbers,
  rowsAfterLeaving,
  seedIngredientRows,
  seedStepRows,
  stepChipLabel,
  stepRowsToSteps,
  typeIngredientRow,
  typeStepRow,
} from "../recipe-editor-rows";

const at = new Date("2026-05-01T10:00:00.000Z");
const labeller = { locale: "en", units: {}, unitStyle: "short" as const };

/** Sections in both lists, `@` references, step photos, notes and a second system. */
const stored: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  name: "Hoisin chicken",
  description: "Sticky and quick.",
  url: null,
  servings: 4,
  prepMinutes: null,
  cookMinutes: 15,
  totalMinutes: null,
  notes: "Thighs stay juicier.",
  systemUsed: "metric",
  originalSystem: "metric",
  calories: null,
  fat: "9",
  carbs: null,
  protein: null,
  originCountry: null,
  originCountryName: null,
  originRegion: null,
  provenanceNote: null,
  dishColor: null,
  cuisines: [],
  createdAt: at,
  updatedAt: at,
  categories: ["Dinner"],
  version: 7,
  tags: [{ name: "quick", version: 1 }],
  recipeIngredients: [
    line("ing-1", "green onions", 3, null, 0),
    line("ing-2", "# For the sauce", null, null, 1),
    line("ing-3", "hoisin sauce", 45, "ml", 2),
    line("ing-4", "salt", null, null, 3),
    { ...line("ing-us", "hoisin sauce", 3, "tbsp", 0), systemUsed: "us" },
  ],
  steps: [
    { step: "# Prep", order: 0, systemUsed: "metric", version: 1, images: [], stepIngredients: [] },
    {
      step: "Slice the green onions, then stir in the hoisin sauce.",
      order: 1,
      systemUsed: "metric",
      version: 4,
      images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
      stepIngredients: [
        { ingredientOrder: 2, share: 0.5, order: 0 },
        { ingredientOrder: 0, share: 1, order: 1 },
      ],
    },
    { step: "Serve.", order: 0, systemUsed: "us", version: 1, images: [], stepIngredients: [] },
  ],
  images: [{ id: "img-1", image: "/recipes/r/a.jpg", order: 0, generated: false, version: 3 }],
  videos: [],
};

function line(
  id: string,
  ingredientName: string,
  amount: number | null,
  unit: string | null,
  order: number
): FullRecipeDTO["recipeIngredients"][number] {
  return {
    id,
    ingredientId: null,
    ingredientName,
    amount,
    unit,
    order,
    systemUsed: "metric",
    version: 1,
  };
}

/** The form as the editor holds it once an edit has seeded its lines and steps. */
function seededForm(): RecipeFormState {
  return {
    ...initialRecipeForm(stored),
    ingredients: editorIngredientsOf(stored, labeller),
    steps: editorStepsOf(stored),
  };
}

const valid = (form: RecipeFormState) => recipeFormPayload({ ...form, servings: form.servings! });

describe("the editor's rows round-trip a stored recipe", () => {
  it("reads amounts in the page's mode and stores the same lines", () => {
    const form = seededForm();
    const line = { ...form.ingredients[0]!, amount: 0.5, unit: "tsp", ingredientName: "salt" };
    const rows = seedIngredientRows([line], "fraction");

    expect(rows[0]?.text).toBe("½ tsp salt");
    expect(seedIngredientRows([line], "decimal")[0]?.text).toBe("0.5 tsp salt");
    expect(seedIngredientRows([line])[0]?.text).toBe("0.5 tsp salt");
    expect(ingredientRowsToLines(rows, {}, "metric")[0]).toEqual(line);
  });

  it.each(["decimal", "fraction"] as const)(
    "never seeds a row with the page's rounding in %s mode",
    (mode) => {
      const line = { ...seededForm().ingredients[0]!, ingredientName: "salt" };

      expect(seedIngredientRows([{ ...line, amount: 12.5, unit: "g" }], mode)[0]?.text).toBe(
        "12.5 g salt"
      );
      expect(seedIngredientRows([{ ...line, amount: 0.636, unit: "cup" }], mode)[0]?.text).toBe(
        "0.636 cup salt"
      );
    }
  );

  it("gives back every line, section, order and reference untouched", () => {
    const form = seededForm();
    const rows = seedIngredientRows(form.ingredients);
    const stepRows = seedStepRows(form.steps);

    // A row edited elsewhere reparses every row; the untouched ones keep their stored line.
    const edited = typeIngredientRow(rows, 3, "a pinch of salt");
    const lines = ingredientRowsToLines(edited, {}, "metric");

    expect(lines.slice(0, 3)).toEqual(form.ingredients.slice(0, 3));
    expect(lines[3]).toMatchObject({
      id: "ing-4",
      ingredientName: expect.stringContaining("salt"),
    });
    expect(ingredientRowsToLines(rows, {}, "metric")).toEqual(form.ingredients);
    expect(stepRowsToSteps(stepRows, "metric")).toEqual(
      form.steps.map((step) => ({
        ...step,
        stepIngredients: step.stepIngredients?.map(({ ingredientOrder, share, order }) => ({
          ingredientOrder,
          share,
          order,
        })),
      }))
    );
  });

  it("saves the stored recipe's active system as it was", () => {
    const payload = valid(seededForm());

    expect(payload.recipeIngredients.map((ing) => [ing.id, ing.ingredientName, ing.order])).toEqual(
      [
        ["ing-1", "green onions", 0],
        ["ing-2", "# For the sauce", 1],
        ["ing-3", "hoisin sauce", 2],
        ["ing-4", "salt", 3],
      ]
    );
    expect(payload.steps[1]).toEqual({
      step: "Slice the green onions, then stir in the hoisin sauce.",
      order: 1,
      systemUsed: "metric",
      version: 4,
      images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
      stepIngredients: [
        { ingredientOrder: 2, share: 0.5, order: 0 },
        { ingredientOrder: 0, share: 1, order: 1 },
      ],
    });
    expect(payload.notes).toBe("Thighs stay juicier.");
    expect(payload.fat).toBe("9");
    expect(payload.prepMinutes).toBeUndefined();
  });

  it("keeps each reference on its line when a cleared row is still in the form", () => {
    const lines = ["A", "B", "C", "D"].map((name, order) => ({
      ...editorIngredientsOf(stored, labeller)[0]!,
      id: `ing-${name}`,
      ingredientName: name,
      order,
    }));
    // B was cleared and not yet left, so the lines skip its order.
    const ingredients = lines.filter((ing) => ing.ingredientName !== "B");
    const steps = [
      {
        ...seededForm().steps[1]!,
        stepIngredients: [
          { ingredientOrder: 2, share: 1, order: 0 },
          { ingredientOrder: 3, share: 0.5, order: 1 },
          { ingredientOrder: 1, share: 1, order: 2 },
        ],
      },
    ];
    const payload = valid({ ...seededForm(), ingredients, steps });
    const nameAt = (order: number) =>
      payload.recipeIngredients.find((ing) => ing.order === order)?.ingredientName;

    expect(payload.steps[0]?.stepIngredients.map((ref) => nameAt(ref.ingredientOrder))).toEqual([
      "C",
      "D",
    ]);
    expect(payload.steps[0]?.stepIngredients.map((ref) => ref.order)).toEqual([0, 1]);
  });

  it("is not dirty until something changes", () => {
    expect(isRecipeFormDirty(seededForm(), "edit", stored, labeller)).toBe(false);
    expect(isRecipeFormDirty({ ...seededForm(), notes: "" }, "edit", stored, labeller)).toBe(true);
    expect(isRecipeFormDirty(initialRecipeForm(), "create", undefined, labeller)).toBe(false);
  });
});

describe("ingredient rows", () => {
  it("numbers lines past the sections", () => {
    expect(rowNumbers(["2 eggs", "# Sauce", "salt", ""])).toEqual([1, null, 2, 3]);
  });

  it("grows when the trailing row is typed into and drops empty rows on reorder", () => {
    const rows = typeIngredientRow(seedIngredientRows([]), 0, "2 eggs");

    expect(rows.map((row) => row.text)).toEqual(["2 eggs", ""]);
    expect(normalizeIngredientRows([rows[1]!, rows[0]!]).map((row) => row.text)).toEqual([
      "2 eggs",
      "",
    ]);
    expect(removeIngredientRow([rows[0]!], 0).map((row) => row.text)).toEqual([""]);
  });

  it("drops an emptied row once left, but never the trailing one", () => {
    const rows = seedIngredientRows(editorIngredientsOf(stored, labeller));
    const emptied = typeIngredientRow(rows, 1, " ");

    expect(rowsAfterLeaving(emptied, 1, hasIngredientContent).map((row) => row.id)).toEqual(
      rows.filter((_, index) => index !== 1).map((row) => row.id)
    );
    expect(rowsAfterLeaving(emptied, 0, hasIngredientContent)).toBe(emptied);
    expect(rowsAfterLeaving(rows, rows.length - 1, hasIngredientContent)).toBe(rows);
  });

  it("reads amount and unit from a typed row", () => {
    const rows = typeIngredientRow(seedIngredientRows([]), 0, "200 g flour");

    expect(ingredientRowsToLines(rows, {}, "metric")).toEqual([
      expect.objectContaining({ ingredientName: "flour", amount: 200, order: 0 }),
    ]);
  });
});

describe("line moves", () => {
  it("keeps a step's references on their lines when a line moves or goes", () => {
    const rows = seedIngredientRows(editorIngredientsOf(stored, labeller));
    const [onions, section, hoisin, salt, trailing] = rows;
    const reordered = [hoisin!, onions!, section!, salt!, trailing!];
    const moves = lineMoves(rows, reordered)!;
    const refs = [
      { ingredientOrder: 2, share: 0.5 },
      { ingredientOrder: 0, share: 1 },
    ];

    expect(remapStepRefs(refs, moves)).toEqual([
      { ingredientOrder: 0, share: 0.5 },
      { ingredientOrder: 1, share: 1 },
    ]);
    expect(remapStepRefs(refs, lineMoves(rows, removeIngredientRow(rows, 0))!)).toEqual([
      { ingredientOrder: 1, share: 0.5 },
    ]);
    expect(lineMoves(rows, typeIngredientRow(rows, 3, "a pinch of salt"))).toBeNull();
  });
});

describe("step rows", () => {
  it("sheds chips on a row that became a heading", () => {
    const rows = seedStepRows(editorStepsOf(stored));
    const steps = stepRowsToSteps(typeStepRow(rows, 1, "# Cook"), "metric");

    expect(steps[1]?.stepIngredients).toEqual([]);
  });

  it("attaches an `@` mention once, asking the amount only for an amounted new line", () => {
    const lines = editorIngredientsOf(stored, labeller);
    const [onions, hoisin, salt] = ingredientSuggestionsOf(lines);
    const rows = seedStepRows([]);
    const first = mentionIngredient(rows, 0, hoisin!, "Stir in hoisin sauce", lines);

    expect(first.asksAmount).toBe(true);
    expect(first.rows[0]?.stepIngredients).toEqual([{ ingredientOrder: 2, share: 1 }]);
    expect(first.rows).toHaveLength(2);

    const again = mentionIngredient(first.rows, 0, hoisin!, "Stir in hoisin sauce twice", lines);

    expect(again.asksAmount).toBe(false);
    expect(again.rows[0]?.stepIngredients).toHaveLength(1);
    expect(mentionIngredient(rows, 0, salt!, "Add salt", lines).asksAmount).toBe(false);
    expect(onions?.label).toBe("green onions");
  });

  it("offers no section headings in the `@` popup", () => {
    expect(
      ingredientSuggestionsOf(editorIngredientsOf(stored, labeller)).map((s) => s.label)
    ).toEqual(["green onions", "hoisin sauce", "salt"]);
  });
});

describe("stepChipLabel", () => {
  it("reads a whole line as its name and part of one as the derived amount", () => {
    const salt = { ingredientName: "salt", amount: 5, unit: "g" };

    expect(stepChipLabel(salt, 1)).toBe("salt");
    expect(stepChipLabel(salt, 0.5)).toBe("2.5 g salt");
    expect(stepChipLabel({ ingredientName: "pepper", amount: null }, 0.5)).toBe("½ × pepper");
  });
});

describe("the `@` and `/` triggers", () => {
  it("opens on an `@` that starts a word and replaces it with the picked name", () => {
    const text = "Season with @sa";
    const match = ingredientTriggerAt(text, text.length);

    expect(match).toEqual({ query: "sa", triggerStart: 12, cursorPosition: 15 });
    expect(replaceTrigger(text, match!, "salt")).toEqual({ text: "Season with salt", caret: 16 });
    expect(ingredientTriggerAt("mail@home", 9)).toBeNull();
    expect(ingredientTriggerAt("@a\nb", 4)).toBeNull();
  });

  it("matches names containing the query, at most eight", () => {
    const suggestions = Array.from({ length: 10 }, (_, i) => ({
      key: `${i}`,
      label: `salt ${i}`,
      ingredientOrder: i,
    }));

    expect(matchIngredientSuggestions(suggestions, " SALT ")).toHaveLength(8);
    expect(matchIngredientSuggestions(suggestions, "9")).toEqual([suggestions[9]]);
  });

  it("opens a recipe link on a `/` after a space", () => {
    expect(recipeTriggerAt("Serve with /ri", 14)).toEqual({
      query: "ri",
      triggerStart: 11,
      cursorPosition: 14,
    });
    expect(recipeTriggerAt("1/2 cup", 3)).toBeNull();
  });
});

describe("validation and detection", () => {
  it("names each missing field", () => {
    expect(validateRecipeForm({ ...initialRecipeForm(), servings: null })).toEqual({
      name: "nameRequired",
      ingredients: "ingredientsRequired",
      steps: "stepsRequired",
      servings: "servingsMin",
    });
    expect(validateRecipeForm(seededForm())).toEqual({});
  });

  it("reads a new recipe's system from its lines", () => {
    const cups = ingredientRowsToLines(
      typeIngredientRow(seedIngredientRows([]), 0, "2 cups flour"),
      {},
      "metric"
    );

    expect(detectFormSystem([], {})).toBeNull();
    expect(detectFormSystem(cups, {})).toBe("us");
  });
});

describe("what an edit's save sends of its lists", () => {
  const opened = seededForm();
  const sent = (form: RecipeFormState) =>
    recipeFormPayload({ ...form, servings: form.servings! }, opened);

  it("leaves out the Tags, Cuisines and Categories the reader did not change", () => {
    const payload = sent({ ...opened, name: "Renamed" });

    expect(payload).toMatchObject({ name: "Renamed" });
    expect(payload).not.toHaveProperty("tags");
    expect(payload).not.toHaveProperty("cuisines");
    expect(payload).not.toHaveProperty("categories");
  });

  it("sends a list the reader changed, whole", () => {
    const payload = sent({
      ...opened,
      tags: [...opened.tags, "spicy"],
      provenance: { ...opened.provenance, cuisineIds: ["c1"] },
    });

    expect(payload.tags).toEqual([{ name: "quick" }, { name: "spicy" }]);
    expect(payload.cuisines).toEqual(["c1"]);
    expect(payload).not.toHaveProperty("categories");
  });

  it("counts the same entries in another order as no change, and an emptied list as one", () => {
    const two = { ...opened, tags: ["quick", "spicy"] };
    const reordered = recipeFormPayload({ ...two, tags: ["spicy", "quick"], servings: 2 }, two);
    const emptied = recipeFormPayload({ ...two, tags: [], categories: [], servings: 2 }, two);

    expect(reordered).not.toHaveProperty("tags");
    expect(emptied).toMatchObject({ tags: [], categories: [] });
  });

  it("sends every list for a new recipe", () => {
    expect(valid(opened)).toMatchObject({ tags: [{ name: "quick" }], categories: ["Dinner"] });
  });
});

describe("a draft kept after a stale answer", () => {
  const opened = seededForm();
  const fresh: FullRecipeDTO = {
    ...stored,
    version: stored.version + 1,
    tags: [{ name: "fresh" }],
    categories: ["Lunch"],
  };

  it("keeps what the reader typed and changed, and takes the fresh lists they left alone", () => {
    const draft = { ...opened, name: "Typed", categories: ["Breakfast"] };
    const rebased = rebaseRecipeForm(draft, opened, fresh, labeller);

    expect(rebased).toMatchObject({ name: "Typed", categories: ["Breakfast"], tags: ["fresh"] });
    expect(rebaseRecipeForm(opened, opened, fresh, labeller)).toMatchObject({
      tags: ["fresh"],
      categories: ["Lunch"],
    });
  });
});
