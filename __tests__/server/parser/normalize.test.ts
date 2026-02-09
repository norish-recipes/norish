// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { normalizeRecipeFromJson } from "@/server/parser/normalize";

// Mock dependencies
vi.mock("@/server/downloader", () => ({
  downloadAllImagesFromJsonLd: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

describe("normalizeRecipeFromJson - HTML Entity Decoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ingredient HTML entity decoding", () => {
    it("decodes en dash (&#8211;) in ingredient array and keeps comments", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [
          "1 cup plain Greek Yogurt &#8211; I used nonfat",
          "1/2 English cucumber &#8211; seeds removed",
        ],
        recipeInstructions: ["Mix well"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(2);
      // Should decode entity and keep comment
      const first = result?.recipeIngredients?.[0];
      const second = result?.recipeIngredients?.[1];

      expect(first?.ingredientName).toContain("–"); // en dash
      expect(first?.ingredientName).toContain("nonfat");
      expect(first?.ingredientName).not.toContain("&#8211;");
      expect(second?.ingredientName).toContain("–");
      expect(second?.ingredientName).toContain("seeds removed");
    });

    it("decodes apostrophe (&#39;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["2 cups baker&#39;s sugar"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("'");
      expect(ingredient?.ingredientName).not.toContain("&#39;");
    });

    it("decodes smart quotes (&#8220;/&#8221;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup &#8220;raw&#8221; sugar"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("\u201C");
      expect(ingredient?.ingredientName).toContain("\u201D");
      expect(ingredient?.ingredientName).not.toContain("&#8220;");
    });

    it("decodes multiple entity types in single ingredient", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup &#8220;baker&#39;s&#8221; flour &#8211; sifted"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("\u201C");
      expect(ingredient?.ingredientName).toContain("'");
      expect(ingredient?.ingredientName).toContain("–");
      expect(ingredient?.ingredientName).toContain("sifted");
    });

    it("handles string ingredient (not array) with entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: "1 cup flour &#8211; sifted",
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("–");
      expect(ingredient?.ingredientName).toContain("sifted");
    });

    it("preserves ingredients without entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour", "2 eggs"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toBe("flour");
      expect(result?.recipeIngredients?.[1]?.ingredientName).toContain("egg");
    });

    it("decodes degree symbol (&#176;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["Water heated to 180&#176;F"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("°");
      expect(ingredient?.ingredientName).not.toContain("&#176;");
    });
  });

  describe("step HTML entity decoding", () => {
    it("decodes en dash (&#8211;) in instruction strings", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: ["Preheat oven to 350&#176;F &#8211; use convection if available"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(1);
      const step = result?.steps?.[0];

      expect(step?.step).toContain("–");
      expect(step?.step).toContain("°");
      expect(step?.step).toContain("use convection if available");
      expect(step?.step).not.toContain("&#8211;");
      expect(step?.step).not.toContain("&#176;");
    });

    it("decodes entities in HowToStep text field", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            text: "Mix until it&#39;s smooth &#8211; about 2 minutes",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("'");
      expect(step?.step).toContain("–");
      expect(step?.step).toContain("about 2 minutes");
      expect(step?.step).not.toContain("&#39;");
    });

    it("decodes entities in HowToStep name field", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Heat oven to 180&#176;C &#8211; gas mark 4",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("°");
      expect(step?.step).toContain("–");
      expect(step?.step).toContain("gas mark 4");
    });

    it("decodes entities in nested HowToStep structures", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: {
          "@type": "HowToSection",
          itemListElement: [
            {
              "@type": "HowToStep",
              text: "Bake for 30&#8211;35 minutes",
            },
          ],
        },
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("–");
      expect(step?.step).not.toContain("&#8211;");
    });

    it("handles mixed string and object instructions", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          "Preheat oven &#8211; 350&#176;F",
          {
            "@type": "HowToStep",
            text: "Mix it&#39;s all together",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(2);
      expect(result?.steps?.[0]?.step).toContain("–");
      expect(result?.steps?.[0]?.step).toContain("°");
      expect(result?.steps?.[1]?.step).toContain("'");
    });
  });

  describe("edge cases", () => {
    it("handles empty ingredients array", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(0);
    });

    it("handles missing recipeIngredient field", async () => {
      const json = {
        name: "Test Recipe",
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(0);
    });

    it("handles null/undefined ingredient values", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [null, undefined, "", "1 cup flour"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.length).toBeGreaterThan(0);
    });

    it("decodes numeric entities (&#NNN;)", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["100g sm&#248;r"],
        recipeInstructions: ["R&#248;r godt"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("ø");
      expect(result?.steps?.[0]?.step).toContain("ø");
    });

    it("decodes hex entities (&#xHH;)", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["caf&#xe9; au lait"],
        recipeInstructions: ["Enjoy your caf&#xe9;"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("é");
      expect(result?.steps?.[0]?.step).toContain("é");
    });

    it("handles named HTML entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["Salt &amp; Pepper"],
        recipeInstructions: ["Mix &lt; 5 minutes"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("&");
      expect(result?.steps?.[0]?.step).toContain("<");
    });
  });
});

describe("normalizeRecipeFromJson - HowToSection Heading Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("section name extraction", () => {
    it("extracts HowToSection name as heading with # prefix", async () => {
      const json = {
        name: "Chocolate Cake",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "For the cake",
            itemListElement: [
              { "@type": "HowToStep", text: "Mix dry ingredients" },
              { "@type": "HowToStep", text: "Add wet ingredients" },
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(3);
      expect(result?.steps?.[0]?.step).toBe("# For the cake");
      expect(result?.steps?.[1]?.step).toBe("Mix dry ingredients");
      expect(result?.steps?.[2]?.step).toBe("Add wet ingredients");
    });

    it("handles multiple HowToSections with headings", async () => {
      const json = {
        name: "Layered Cake",
        recipeIngredient: ["flour", "sugar"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "For the cake",
            itemListElement: [{ "@type": "HowToStep", text: "Bake the cake" }],
          },
          {
            "@type": "HowToSection",
            name: "For the frosting",
            itemListElement: [{ "@type": "HowToStep", text: "Make the frosting" }],
          },
          {
            "@type": "HowToSection",
            name: "Assembly",
            itemListElement: [{ "@type": "HowToStep", text: "Apply frosting to cake" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(6);
      expect(result?.steps?.[0]?.step).toBe("# For the cake");
      expect(result?.steps?.[1]?.step).toBe("Bake the cake");
      expect(result?.steps?.[2]?.step).toBe("# For the frosting");
      expect(result?.steps?.[3]?.step).toBe("Make the frosting");
      expect(result?.steps?.[4]?.step).toBe("# Assembly");
      expect(result?.steps?.[5]?.step).toBe("Apply frosting to cake");
    });

    it("handles HowToSection without name (no heading emitted)", async () => {
      const json = {
        name: "Simple Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            itemListElement: [
              { "@type": "HowToStep", text: "Step one" },
              { "@type": "HowToStep", text: "Step two" },
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(2);
      // No heading should be present since section has no name
      expect(result?.steps?.[0]?.step).toBe("Step one");
      expect(result?.steps?.[1]?.step).toBe("Step two");
    });

    it("handles mixed sections with and without names", async () => {
      const json = {
        name: "Mixed Sections Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Preparation",
            itemListElement: [{ "@type": "HowToStep", text: "Prep step" }],
          },
          {
            "@type": "HowToSection",
            itemListElement: [{ "@type": "HowToStep", text: "Unnamed section step" }],
          },
          {
            "@type": "HowToSection",
            name: "Final Steps",
            itemListElement: [{ "@type": "HowToStep", text: "Final step" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(5);
      expect(result?.steps?.[0]?.step).toBe("# Preparation");
      expect(result?.steps?.[1]?.step).toBe("Prep step");
      expect(result?.steps?.[2]?.step).toBe("Unnamed section step");
      expect(result?.steps?.[3]?.step).toBe("# Final Steps");
      expect(result?.steps?.[4]?.step).toBe("Final step");
    });

    it("decodes HTML entities in section names", async () => {
      const json = {
        name: "Recipe with Entities",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "For the cr&#232;me br&#251;l&#233;e",
            itemListElement: [{ "@type": "HowToStep", text: "Make custard" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("# For the crème brûlée");
    });

    it("handles section name with special characters", async () => {
      const json = {
        name: "Special Chars Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Step 1: Mix &amp; Combine",
            itemListElement: [{ "@type": "HowToStep", text: "Do the mixing" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("# Step 1: Mix & Combine");
    });
  });

  describe("nested and complex structures", () => {
    it("handles deeply nested HowToSection in single object", async () => {
      const json = {
        name: "Nested Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: {
          "@type": "HowToSection",
          name: "Main Section",
          itemListElement: [
            { "@type": "HowToStep", text: "First step" },
            { "@type": "HowToStep", text: "Second step" },
          ],
        },
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(3);
      expect(result?.steps?.[0]?.step).toBe("# Main Section");
      expect(result?.steps?.[1]?.step).toBe("First step");
      expect(result?.steps?.[2]?.step).toBe("Second step");
    });

    it("handles HowToSection with mixed string and object steps", async () => {
      const json = {
        name: "Mixed Steps Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Baking",
            itemListElement: [
              "Preheat oven",
              { "@type": "HowToStep", text: "Mix ingredients" },
              "Bake for 30 minutes",
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(4);
      expect(result?.steps?.[0]?.step).toBe("# Baking");
      expect(result?.steps?.[1]?.step).toBe("Preheat oven");
      expect(result?.steps?.[2]?.step).toBe("Mix ingredients");
      expect(result?.steps?.[3]?.step).toBe("Bake for 30 minutes");
    });

    it("handles case-insensitive @type matching for HowToSection", async () => {
      const json = {
        name: "Case Test Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "howtosection",
            name: "Lowercase Section",
            itemListElement: [{ "@type": "HowToStep", text: "Step A" }],
          },
          {
            "@type": "HOWTOSECTION",
            name: "Uppercase Section",
            itemListElement: [{ "@type": "HowToStep", text: "Step B" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(4);
      expect(result?.steps?.[0]?.step).toBe("# Lowercase Section");
      expect(result?.steps?.[2]?.step).toBe("# Uppercase Section");
    });

    it("preserves step order across sections", async () => {
      const json = {
        name: "Ordered Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Part 1",
            itemListElement: [
              { "@type": "HowToStep", text: "Step 1" },
              { "@type": "HowToStep", text: "Step 2" },
            ],
          },
          {
            "@type": "HowToSection",
            name: "Part 2",
            itemListElement: [
              { "@type": "HowToStep", text: "Step 3" },
              { "@type": "HowToStep", text: "Step 4" },
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Verify order numbers are sequential
      expect(result?.steps?.[0]?.order).toBe(1); // # Part 1
      expect(result?.steps?.[1]?.order).toBe(2); // Step 1
      expect(result?.steps?.[2]?.order).toBe(3); // Step 2
      expect(result?.steps?.[3]?.order).toBe(4); // # Part 2
      expect(result?.steps?.[4]?.order).toBe(5); // Step 3
      expect(result?.steps?.[5]?.order).toBe(6); // Step 4
    });
  });

  describe("edge cases", () => {
    it("handles empty section name (treated as no name)", async () => {
      const json = {
        name: "Empty Name Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "",
            itemListElement: [{ "@type": "HowToStep", text: "Step content" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Empty name should not produce a heading
      expect(result?.steps).toHaveLength(1);
      expect(result?.steps?.[0]?.step).toBe("Step content");
    });

    it("handles whitespace-only section name", async () => {
      const json = {
        name: "Whitespace Name Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "   ",
            itemListElement: [{ "@type": "HowToStep", text: "Step content" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Whitespace-only name should not produce a heading
      expect(result?.steps).toHaveLength(1);
      expect(result?.steps?.[0]?.step).toBe("Step content");
    });

    it("handles section with empty itemListElement", async () => {
      const json = {
        name: "Empty Section Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Empty Section",
            itemListElement: [],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Should still include the heading even if no steps
      expect(result?.steps).toHaveLength(1);
      expect(result?.steps?.[0]?.step).toBe("# Empty Section");
    });

    it("does not deduplicate repeated section headings", async () => {
      const json = {
        name: "Repeated Sections Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Repeat",
            itemListElement: [{ "@type": "HowToStep", text: "Step A" }],
          },
          {
            "@type": "HowToSection",
            name: "Repeat",
            itemListElement: [{ "@type": "HowToStep", text: "Step B" }],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Both headings should be preserved (not deduplicated)
      expect(result?.steps).toHaveLength(4);
      expect(result?.steps?.[0]?.step).toBe("# Repeat");
      expect(result?.steps?.[2]?.step).toBe("# Repeat");
    });
  });
});

describe("normalizeRecipeFromJson - HowToStep Bold Name Extraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("step name + text combination", () => {
    it("combines name and text as **Name:** Text format", async () => {
      const json = {
        name: "Recipe with Step Names",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Prep",
            text: "Trim the stem of the collard leaf.",
          },
          {
            "@type": "HowToStep",
            name: "Roll",
            text: "Arrange your fillings on the collard leaf.",
          },
          {
            "@type": "HowToStep",
            name: "Peanut Sauce",
            text: "Run all the ingredients through a blender.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(3);
      expect(result?.steps?.[0]?.step).toBe("**Prep:** Trim the stem of the collard leaf.");
      expect(result?.steps?.[1]?.step).toBe("**Roll:** Arrange your fillings on the collard leaf.");
      expect(result?.steps?.[2]?.step).toBe(
        "**Peanut Sauce:** Run all the ingredients through a blender."
      );
    });

    it("uses text only when name is not present", async () => {
      const json = {
        name: "Recipe without Step Names",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            text: "Mix the ingredients together.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("Mix the ingredients together.");
    });

    it("uses name only when text is not present", async () => {
      const json = {
        name: "Recipe with Name Only Steps",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Mix well until combined",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("Mix well until combined");
    });

    it("handles mixed steps with and without names", async () => {
      const json = {
        name: "Mixed Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Prepare",
            text: "Get ingredients ready.",
          },
          {
            "@type": "HowToStep",
            text: "Mix everything together.",
          },
          {
            "@type": "HowToStep",
            name: "Serve",
            text: "Plate and serve immediately.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(3);
      expect(result?.steps?.[0]?.step).toBe("**Prepare:** Get ingredients ready.");
      expect(result?.steps?.[1]?.step).toBe("Mix everything together.");
      expect(result?.steps?.[2]?.step).toBe("**Serve:** Plate and serve immediately.");
    });

    it("decodes HTML entities in both name and text", async () => {
      const json = {
        name: "Entity Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Mix &#8211; Combine",
            text: "Stir it&#39;s all together &#8211; about 2 minutes.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe(
        "**Mix – Combine:** Stir it's all together – about 2 minutes."
      );
    });

    it("handles step names with special characters", async () => {
      const json = {
        name: "Special Chars Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Step 1: Mix & Combine",
            text: "Fold the ingredients.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      // Note: the & in name doesn't need HTML entity decoding here
      expect(result?.steps?.[0]?.step).toBe("**Step 1: Mix & Combine:** Fold the ingredients.");
    });
  });

  describe("step names in HowToSection", () => {
    it("combines name and text within HowToSection", async () => {
      const json = {
        name: "Sectioned Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Preparation",
            itemListElement: [
              {
                "@type": "HowToStep",
                name: "Prep",
                text: "Gather all ingredients.",
              },
              {
                "@type": "HowToStep",
                name: "Measure",
                text: "Measure out each ingredient.",
              },
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(3);
      expect(result?.steps?.[0]?.step).toBe("# Preparation");
      expect(result?.steps?.[1]?.step).toBe("**Prep:** Gather all ingredients.");
      expect(result?.steps?.[2]?.step).toBe("**Measure:** Measure out each ingredient.");
    });

    it("handles mixed named and unnamed steps in sections", async () => {
      const json = {
        name: "Mixed Section Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Baking",
            itemListElement: [
              {
                "@type": "HowToStep",
                name: "Preheat",
                text: "Heat oven to 350°F.",
              },
              {
                "@type": "HowToStep",
                text: "Mix dry ingredients.",
              },
              {
                "@type": "HowToStep",
                name: "Bake",
                text: "Place in oven for 30 minutes.",
              },
            ],
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(4);
      expect(result?.steps?.[0]?.step).toBe("# Baking");
      expect(result?.steps?.[1]?.step).toBe("**Preheat:** Heat oven to 350°F.");
      expect(result?.steps?.[2]?.step).toBe("Mix dry ingredients.");
      expect(result?.steps?.[3]?.step).toBe("**Bake:** Place in oven for 30 minutes.");
    });
  });

  describe("edge cases for bold names", () => {
    it("handles empty name string (uses text only)", async () => {
      const json = {
        name: "Empty Name Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "",
            text: "Mix ingredients.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("Mix ingredients.");
    });

    it("handles whitespace-only name (uses text only)", async () => {
      const json = {
        name: "Whitespace Name Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "   ",
            text: "Mix ingredients.",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("Mix ingredients.");
    });

    it("handles empty text string (uses name only)", async () => {
      const json = {
        name: "Empty Text Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Mix everything",
            text: "",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("Mix everything");
    });

    it("trims whitespace from name and text", async () => {
      const json = {
        name: "Whitespace Recipe",
        recipeIngredient: ["flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "  Prep  ",
            text: "  Trim the vegetables.  ",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps?.[0]?.step).toBe("**Prep:** Trim the vegetables.");
    });
  });
});

describe("normalizeRecipeFromJson - Notes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts recipeNotes into notes", async () => {
    const json = {
      name: "Notes Recipe",
      recipeNotes: "Use ripe tomatoes and rest for 10 minutes.",
      recipeIngredient: ["2 tomatoes"],
      recipeInstructions: ["Slice and serve"],
    };

    const result = await normalizeRecipeFromJson(json);

    expect(result).not.toBeNull();
    expect(result?.notes).toBe("Use ripe tomatoes and rest for 10 minutes.");
  });
});

describe("recipeCategory extraction", () => {
  it("extracts recipeCategory as string and maps to enum", async () => {
    const json = {
      name: "Pancakes",
      recipeIngredient: ["flour"],
      recipeInstructions: ["Mix"],
      recipeCategory: "breakfast",
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toEqual(["Breakfast"]);
  });

  it("extracts recipeCategory as array", async () => {
    const json = {
      name: "Eggs",
      recipeIngredient: ["eggs"],
      recipeInstructions: ["Cook"],
      recipeCategory: ["breakfast", "dinner"],
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toContain("Breakfast");
    expect(result?.categories).toContain("Dinner");
  });

  it("handles comma-separated recipeCategory string", async () => {
    const json = {
      name: "Toast",
      recipeIngredient: ["bread"],
      recipeInstructions: ["Toast"],
      recipeCategory: "breakfast, snack",
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toContain("Breakfast");
    expect(result?.categories).toContain("Snack");
  });

  it("ignores unmappable recipeCategory values gracefully", async () => {
    const json = {
      name: "Mystery",
      recipeIngredient: ["stuff"],
      recipeInstructions: ["Do things"],
      recipeCategory: "exotic fusion cuisine",
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toEqual([]);
  });

  it("returns empty categories when recipeCategory missing", async () => {
    const json = {
      name: "Simple",
      recipeIngredient: ["water"],
      recipeInstructions: ["Boil"],
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toEqual([]);
  });

  it("maps alternative category names (entree -> Dinner)", async () => {
    const json = {
      name: "Steak",
      recipeIngredient: ["steak"],
      recipeInstructions: ["Grill"],
      recipeCategory: "entree",
    };
    const result = await normalizeRecipeFromJson(json);

    expect(result?.categories).toEqual(["Dinner"]);
  });
});
