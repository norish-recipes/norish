// @vitest-environment node
import { describe, expect, it } from "vitest";

import { recipePageText } from "@norish/api/parser/recipe-page-text";

const page = (body: string) => `<html><body><main>${body}</main></body></html>`;

const PAGE = page(`
  <p>Some menu text</p>
  <h2>Shepherd's Pie (With Lamb)</h2>
  <p>A long story.</p>
  <p>For the Mash:</p><ul><li>1 kg potatoes</li></ul>
  <p>For the Sauce:</p><ul><li>500 g lamb (1.1 lb)</li></ul>
  <p>Boil the potatoes.</p>
  <p>Bake at 200 C until golden on top.</p>
  <p>Comments and more recipes</p>
`);

const RECIPE = {
  name: "Shepherd&#39;s Pie (With Lamb)",
  recipeInstructions: [
    { "@type": "HowToStep", text: "Boil the potatoes." },
    { "@type": "HowToStep", text: "Bake at 200 C until golden  on top!" },
  ],
};

describe("recipePageText", () => {
  it("runs from the title to the end of the last step, section headings included", () => {
    const text = recipePageText(PAGE, RECIPE);

    expect(text.startsWith("Shepherd's Pie")).toBe(true);
    expect(text).toContain("For the Mash:");
    expect(text).toContain("For the Sauce:");
    expect(text).toContain("Bake at 200 C until golden on top");
    expect(text).not.toContain("Some menu text");
    expect(text).not.toContain("Comments and more recipes");
  });

  it("finds the last step in a section's list", () => {
    const text = recipePageText(PAGE, {
      ...RECIPE,
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "To finish",
          itemListElement: [{ "@type": "HowToStep", text: "Boil the potatoes." }],
        },
      ],
    });

    expect(text.endsWith("Boil the potatoes.")).toBe(true);
  });

  it.each([
    ["the title is not on the page", { ...RECIPE, name: "Another name" }],
    ["the recipe has no title", { recipeInstructions: RECIPE.recipeInstructions }],
    [
      "the last step is not on the page",
      { ...RECIPE, recipeInstructions: ["Something else entirely."] },
    ],
    ["the recipe has no steps", { name: RECIPE.name }],
    ["the title only comes after the last step", { ...RECIPE, name: "more recipes" }],
  ])("is the whole cleaned page when %s", (_case, recipe) => {
    const text = recipePageText(PAGE, recipe);

    expect(text).toContain("Some menu text");
    expect(text).toContain("Comments and more recipes");
  });
});
