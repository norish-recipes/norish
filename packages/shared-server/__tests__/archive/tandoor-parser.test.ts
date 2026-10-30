import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TandoorRecipe } from "@norish/shared-server/archive/tandoor-parser";
import {
  extractTandoorRecipes,
  parseTandoorRecipeToDTO,
  TandoorRecipeSchema,
} from "@norish/shared-server/archive/tandoor-parser";

// @vitest-environment node

// Mock the server config loader to avoid database calls
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({
    volume: {},
    mass: {},
    length: {},
    temperature: {},
  }),
  getContentIndicators: vi.fn().mockResolvedValue([]),
  getRecurrenceConfig: vi.fn().mockResolvedValue({}),
}));

// Mock the downloader to avoid actual image saving
vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

describe("Tandoor Parser", () => {
  describe("TandoorRecipeSchema", () => {
    it("validates a complete Tandoor recipe", () => {
      const recipe = {
        name: "Test Recipe",
        description: "A test recipe",
        keywords: [{ name: "dinner" }],
        steps: [
          {
            instruction: "Mix ingredients",
            ingredients: [
              {
                food: { name: "flour", supermarket_category: null },
                unit: { name: "gram" },
                amount: 200,
                order: 0,
              },
            ],
            order: 0,
          },
        ],
        working_time: 15,
        waiting_time: 30,
        servings: 4,
        source_url: "https://example.com/recipe",
      };

      const result = TandoorRecipeSchema.parse(recipe);

      expect(result.name).toBe("Test Recipe");
      expect(result.keywords).toHaveLength(1);
      expect(result.steps).toHaveLength(1);
    });

    it("validates minimal recipe", () => {
      const recipe = {
        name: "Minimal Recipe",
      };

      const result = TandoorRecipeSchema.parse(recipe);

      expect(result.name).toBe("Minimal Recipe");
      expect(result.keywords).toEqual([]);
      expect(result.steps).toEqual([]);
    });

    it("accepts nullable fields from Tandoor exports", () => {
      const recipe = {
        name: "Nullable Recipe",
        description: null,
        keywords: null,
        steps: [
          {
            name: null,
            instruction: "Mix everything",
            ingredients: [
              {
                food: {
                  name: "milk",
                  plural_name: null,
                  ignore_shopping: null,
                  supermarket_category: null,
                },
                unit: {
                  name: "ml",
                  plural_name: null,
                  description: null,
                },
                amount: null,
                note: null,
                order: null,
                is_header: null,
                no_amount: null,
                always_use_plural_unit: null,
                always_use_plural_food: null,
              },
            ],
            time: null,
            order: null,
            show_as_header: null,
            show_ingredients_table: null,
          },
        ],
        working_time: null,
        waiting_time: null,
        internal: null,
        nutrition: null,
        servings: null,
        servings_text: null,
        source_url: null,
      } as any;

      const result = TandoorRecipeSchema.parse(recipe);

      expect(result.keywords).toEqual([]);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].ingredients[0].note).toBeNull();
      expect(result.servings_text).toBeNull();
    });

    it("throws on missing name", () => {
      expect(() => TandoorRecipeSchema.parse({})).toThrow();
    });

    it("accepts object supermarket_category and normalizes it", () => {
      const recipe = {
        name: "With Supermarket Category Object",
        steps: [
          {
            instruction: "Test",
            ingredients: [
              {
                food: {
                  name: "flour",
                  supermarket_category: {
                    name: "Baking",
                    extra: "ignored",
                  } as any,
                },
                unit: { name: "gram" },
                amount: 100,
              },
            ],
          },
        ],
      } satisfies Partial<TandoorRecipe>;

      const parsed = TandoorRecipeSchema.parse(recipe);

      expect(parsed.steps?.[0].ingredients?.[0].food?.supermarket_category).toBe("Baking");
    });
  });

  describe("parseTandoorRecipeToDTO", () => {
    let mockRecipe: TandoorRecipe;

    beforeEach(() => {
      mockRecipe = {
        name: "'Bami'",
        description:
          "Deze 'bami' heb je zo bij elkaar gewokt door het gebruik van het groente- en vleespakket (scheelt snijden). Ook handig: de boemboe die de boel wat smaak geeft.",
        keywords: [
          { name: "hoofdgerecht", description: "" },
          { name: "roerbakken/wokken", description: "" },
          { name: "snel", description: "" },
        ],
        steps: [
          {
            name: "",
            instruction: "Bereid de mie volgens de aanwijzingen op de verpakking en giet af.",
            ingredients: [
              {
                food: { name: "mienestjes", supermarket_category: null },
                unit: { name: "gram" },
                amount: 300,
                order: 0,
                is_header: false,
              },
              {
                food: { name: "bamigroentepakket", supermarket_category: null },
                unit: { name: "gram" },
                amount: 900,
                order: 1,
                is_header: false,
              },
            ],
            time: 0,
            order: 0,
          },
          {
            name: "",
            instruction:
              "Snijd ondertussen 1 rode peper uit de bamigroente (per 4 personen) fijn, de andere peper wordt niet gebruikt.",
            ingredients: [],
            time: 15,
            order: 1,
          },
        ],
        working_time: 15,
        waiting_time: 0,
        servings: 4,
        servings_text: "1",
        source_url: "http://www.ah.nl/allerhande/recept/R-R1199970/bami",
      };
    });

    it("converts Tandoor recipe to DTO", async () => {
      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.name).toBe("'Bami'");
      expect(dto.description).toContain("bami");
      expect(dto.url).toBe("http://www.ah.nl/allerhande/recept/R-R1199970/bami");
      expect(dto.servings).toBe(4);
      expect(dto.prepMinutes).toBe(15);
      expect(dto.cookMinutes).toBeUndefined(); // 0 is treated as undefined
      expect(dto.totalMinutes).toBe(15); // only prepMinutes contributes
      expect(dto.systemUsed).toBe("metric");
    });

    it("flattens ingredients from all steps", async () => {
      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.recipeIngredients).toHaveLength(2);
      expect(dto.recipeIngredients![0].ingredientName).toBe("mienestjes");
      expect(dto.recipeIngredients![0].amount).toBe(300);
      expect(dto.recipeIngredients![0].unit).toBe("gram");
      expect(dto.recipeIngredients![0].order).toBe(0);
      expect(dto.recipeIngredients![1].ingredientName).toBe("bamigroentepakket");
      expect(dto.recipeIngredients![1].order).toBe(1);
    });

    it("maps steps correctly (ignoring nested ingredients)", async () => {
      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.steps).toHaveLength(2);
      expect(dto.steps![0].step).toBe(
        "Bereid de mie volgens de aanwijzingen op de verpakking en giet af."
      );
      expect(dto.steps![1].step).toContain("rode peper");
    });

    describe("step ingredient links", () => {
      const recipeId = "123e4567-e89b-42d3-a456-426614174000";

      it("links each ingredient line to the step that listed it", async () => {
        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.steps![0].stepIngredients).toEqual([
          { ingredientOrder: 0, share: 1, order: 0 },
          { ingredientOrder: 1, share: 1, order: 1 },
        ]);
        // The second step lists no ingredients, so it stays bare.
        expect(dto.steps![1].stepIngredients).toEqual([]);
      });

      it("references lines by the order they were given in recipeIngredients", async () => {
        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);
        const linkedNames = dto.steps![0].stepIngredients!.map(
          (link) =>
            dto.recipeIngredients!.find((line) => line.order === link.ingredientOrder)
              ?.ingredientName
        );

        expect(linkedNames).toEqual(["mienestjes", "bamigroentepakket"]);
      });

      it("keeps links aligned when header and nameless ingredients are skipped", async () => {
        mockRecipe.steps = [
          {
            instruction: "First",
            ingredients: [
              { food: { name: "Dry", supermarket_category: null }, is_header: true },
              { food: { name: "flour", supermarket_category: null }, amount: 200 },
              { food: { name: "  ", supermarket_category: null }, amount: 1 },
            ],
            order: 0,
          },
          {
            instruction: "Second",
            ingredients: [{ food: { name: "milk", supermarket_category: null }, amount: 100 }],
            order: 1,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients!.map((line) => line.ingredientName)).toEqual([
          "flour",
          "milk",
        ]);
        expect(dto.steps![0].stepIngredients).toEqual([{ ingredientOrder: 0, share: 1, order: 0 }]);
        expect(dto.steps![1].stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      });

      it("keeps links aligned when an empty step is dropped", async () => {
        mockRecipe.steps = [
          {
            instruction: "",
            ingredients: [{ food: { name: "salt", supermarket_category: null }, amount: 1 }],
            order: 0,
          },
          {
            instruction: "Cook it",
            ingredients: [{ food: { name: "rice", supermarket_category: null }, amount: 200 }],
            order: 1,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        // The ingredient of the dropped step is still imported, just unlinked.
        expect(dto.recipeIngredients!.map((line) => line.ingredientName)).toEqual(["salt", "rice"]);
        expect(dto.steps).toHaveLength(1);
        expect(dto.steps![0].stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      });

      it("keeps links with their own step when steps arrive out of order", async () => {
        mockRecipe.steps = [
          {
            instruction: "Second",
            ingredients: [{ food: { name: "milk", supermarket_category: null }, amount: 100 }],
            order: 1,
          },
          {
            instruction: "First",
            ingredients: [{ food: { name: "flour", supermarket_category: null }, amount: 200 }],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);
        const lineName = (order: number) =>
          dto.recipeIngredients!.find((line) => line.order === order)?.ingredientName;

        expect(dto.steps!.map((step) => step.step)).toEqual(["First", "Second"]);
        expect(lineName(dto.steps![0].stepIngredients![0].ingredientOrder)).toBe("flour");
        expect(lineName(dto.steps![1].stepIngredients![0].ingredientOrder)).toBe("milk");
      });

      it("links a real Tandoor export (tuna pasta bake)", async () => {
        const food = (name: string) => ({ name, supermarket_category: null });
        const tuna = {
          name: "Tuna pasta bake",
          servings: 2,
          steps: [
            { instruction: "Heat oven to 180C.", ingredients: [], order: 0 },
            {
              instruction: "Boil the pasta.",
              ingredients: [{ food: food("Pasta"), unit: { name: "g" }, amount: 300 }],
              order: 0,
            },
            {
              instruction: "Melt the butter and stir in the flour.",
              ingredients: [
                { food: food("butter"), unit: { name: "g" }, amount: 25 },
                { food: food("flour"), unit: { name: "g" }, amount: 25 },
              ],
              order: 0,
            },
            {
              instruction: "Stir in the milk.",
              ingredients: [{ food: food("milk"), unit: { name: "ml" }, amount: 300 }],
              order: 0,
            },
            {
              instruction: "Stir in the cheddar.",
              ingredients: [{ food: food("cheddar grated"), unit: { name: "g" }, amount: 125 }],
              order: 0,
            },
            {
              instruction: "Mix with tuna, sweetcorn and parsley.",
              ingredients: [
                { food: food("tuna steak"), unit: { name: "can" }, amount: 1 },
                { food: food("sweetcorn"), unit: { name: "g" }, amount: 150 },
                { food: food("parsely"), unit: { name: "handful" }, amount: 1 },
              ],
              order: 0,
            },
            { instruction: "Transfer to a baking dish.", ingredients: [], order: 0 },
            { instruction: "Bake for 15-20 mins.", ingredients: [], order: 0 },
          ],
        } as TandoorRecipe;

        const dto = await parseTandoorRecipeToDTO(tuna, recipeId);

        expect(dto.recipeIngredients!.map((line) => line.ingredientName)).toEqual([
          "Pasta",
          "butter",
          "flour",
          "milk",
          "cheddar grated",
          "tuna steak",
          "sweetcorn",
          "parsely",
        ]);
        expect(
          dto.steps!.map((step) => step.stepIngredients!.map((l) => l.ingredientOrder))
        ).toEqual([[], [0], [1, 2], [3], [4], [5, 6, 7], [], []]);
      });
    });

    it("prepends step name to instruction in bold", async () => {
      mockRecipe.steps = [
        {
          name: "Step Note",
          instruction: "Do the thing",
          ingredients: [],
          order: 0,
        },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.steps).toHaveLength(1);
      expect(dto.steps![0].step).toBe("**Step Note** Do the thing");
    });

    it("extracts tags from keywords", async () => {
      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.tags).toHaveLength(3);
      expect(dto.tags![0].name).toBe("hoofdgerecht");
      expect(dto.tags![1].name).toBe("roerbakken/wokken");
      expect(dto.tags![2].name).toBe("snel");
    });

    it("derives categories from keyword tags", async () => {
      mockRecipe.keywords = [
        { name: "breakfast", description: "" },
        { name: "diner", description: "" },
        { name: "snack", description: "" },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.categories).toContain("Breakfast");
      expect(dto.categories).toContain("Dinner");
      expect(dto.categories).toContain("Snack");
    });

    it("derives categories from localized keyword tags", async () => {
      mockRecipe.keywords = [
        { name: "Ontbijt", description: "" },
        { name: "dejeuner", description: "" },
        { name: "Abendessen", description: "" },
        { name: "Collation", description: "" },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.categories).toContain("Breakfast");
      expect(dto.categories).toContain("Lunch");
      expect(dto.categories).toContain("Dinner");
      expect(dto.categories).toContain("Snack");
    });

    it("reads working time as prep and waiting time as Other Time", async () => {
      mockRecipe.working_time = 20;
      mockRecipe.waiting_time = 40;

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.prepMinutes).toBe(20);
      // Waiting is not cooking: it shows as the rest of the total.
      expect(dto.cookMinutes).toBeUndefined();
      expect(dto.totalMinutes).toBe(60);
    });

    it("handles recipe with no times", async () => {
      mockRecipe.working_time = null;
      mockRecipe.waiting_time = null;

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.prepMinutes).toBeUndefined();
      expect(dto.cookMinutes).toBeUndefined();
      expect(dto.totalMinutes).toBeUndefined();
    });

    it("saves image when buffer provided", async () => {
      const imageBuffer = Buffer.from("fake-image-data");
      const dto = await parseTandoorRecipeToDTO(
        mockRecipe,
        "123e4567-e89b-42d3-a456-426614174000",
        imageBuffer
      );

      expect(dto.images).toEqual([{ image: "mocked-image-guid", order: 0 }]);
    });

    it("detects US system from cup units", async () => {
      mockRecipe.steps[0].ingredients = [
        {
          food: { name: "flour", supermarket_category: null },
          unit: { name: "cup" },
          amount: 2,
          order: 0,
        },
        {
          food: { name: "sugar", supermarket_category: null },
          unit: { name: "oz" },
          amount: 4,
          order: 1,
        },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.systemUsed).toBe("us");
      expect(dto.recipeIngredients![0].systemUsed).toBe("us");
    });

    it("defaults to metric system for mixed/unknown units", async () => {
      mockRecipe.steps[0].ingredients = [
        {
          food: { name: "flour", supermarket_category: null },
          unit: { name: "gram" },
          amount: 200,
          order: 0,
        },
        {
          food: { name: "sugar", supermarket_category: null },
          unit: { name: "cup" },
          amount: 1,
          order: 1,
        },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      // Metric should win (1 vs 1, ties go to metric)
      expect(dto.systemUsed).toBe("metric");
    });

    it("skips a header row with no note, whatever food it carries", async () => {
      mockRecipe.steps[0].ingredients = [
        {
          food: { name: "Dry Ingredients", supermarket_category: null },
          unit: { name: "" },
          amount: null,
          order: 0,
          is_header: true,
        },
        {
          food: { name: "flour", supermarket_category: null },
          unit: { name: "gram" },
          amount: 200,
          order: 1,
          is_header: false,
        },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.recipeIngredients).toHaveLength(1);
      expect(dto.recipeIngredients![0].ingredientName).toBe("flour");
    });

    describe("what a Tandoor reader sees", () => {
      const recipeId = "123e4567-e89b-42d3-a456-426614174000";
      const food = (name: string, plural_name?: string) => ({
        name,
        plural_name,
        supermarket_category: null,
      });

      it("keeps a header row as a Heading from its note, ignoring a stale food", async () => {
        mockRecipe.steps = [
          {
            instruction: "Mix.",
            ingredients: [
              { food: food("Dry ingredients"), note: "For the dough", is_header: true },
              { food: food("flour"), unit: { name: "g" }, amount: 200 },
            ],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients).toMatchObject([
          { ingredientName: "# For the dough", amount: null, unit: null, order: 0 },
          { ingredientName: "flour", amount: 200, unit: "g", order: 1, foodTexts: ["flour"] },
        ]);
        // The Heading counts as a line, but is never one of the step's ingredients.
        expect(dto.steps![0].stepIngredients).toEqual([{ ingredientOrder: 1, share: 1, order: 0 }]);
      });

      it("keeps a line's note, and a line that is a note alone", async () => {
        mockRecipe.steps = [
          {
            instruction: "Serve.",
            ingredients: [
              { food: food("parsley"), amount: 1, note: "chopped" },
              { note: "salt and pepper to taste" },
            ],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients!.map((line) => line.ingredientName)).toEqual([
          "parsley, chopped",
          "salt and pepper to taste",
        ]);
        expect(dto.steps![0].stepIngredients).toHaveLength(2);
      });

      it("gives no amount or unit to a line Tandoor says has none", async () => {
        mockRecipe.steps = [
          {
            instruction: "Season.",
            ingredients: [
              { food: food("salt"), unit: { name: "pinch" }, amount: 1, no_amount: true },
              { food: food("pepper"), unit: { name: "g" }, amount: 0 },
            ],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients).toMatchObject([
          { ingredientName: "salt", amount: null, unit: null },
          { ingredientName: "pepper", amount: null, unit: null },
        ]);
      });

      it("names a food in its plural when the amount is not 1", async () => {
        mockRecipe.steps = [
          {
            instruction: "Peel.",
            ingredients: [
              { food: food("onion", "onions"), amount: 3 },
              { food: food("lemon", "lemons"), amount: 1 },
              // An amount of 0 is no amount, so nothing is counted.
              { food: food("lime", "limes"), amount: 0 },
            ],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients).toMatchObject([
          // The line reads as Tandoor shows it and resolves from the food's name.
          { ingredientName: "onions", foodTexts: ["onion"] },
          { ingredientName: "lemon", foodTexts: ["lemon"] },
          { ingredientName: "lime", amount: null },
        ]);
      });

      it("renders templated step text, counting header rows in the index", async () => {
        mockRecipe.steps = [
          {
            instruction:
              "Whisk {{ ingredients[1] }} with {{ingredients[2].food}} ({{ ingredients[2].note }}) for {{ scale(2) }} {minutes}.",
            ingredients: [
              { note: "For the batter", is_header: true },
              { food: food("egg", "eggs"), amount: 2 },
              {
                food: food("sugar"),
                unit: { name: "g", plural_name: "g" },
                amount: 50,
                note: "caster",
              },
            ],
            order: 0,
          },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.steps![0].step).toBe("Whisk 2 eggs with sugar (caster) for 2 minutes.");
      });

      it("walks the lines in the order the steps are shown", async () => {
        mockRecipe.steps = [
          { instruction: "Second", ingredients: [{ food: food("milk"), amount: 1 }], order: 1 },
          { instruction: "First", ingredients: [{ food: food("flour"), amount: 1 }], order: 0 },
        ];

        const dto = await parseTandoorRecipeToDTO(mockRecipe, recipeId);

        expect(dto.recipeIngredients!.map((line) => line.ingredientName)).toEqual([
          "flour",
          "milk",
        ]);
      });
    });

    it("filters out empty steps", async () => {
      mockRecipe.steps = [
        {
          instruction: "Valid step",
          ingredients: [],
          order: 0,
        },
        {
          instruction: "",
          ingredients: [],
          order: 1,
        },
        {
          instruction: "  ",
          ingredients: [],
          order: 2,
        },
      ];

      const dto = await parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000");

      expect(dto.steps).toHaveLength(1);
      expect(dto.steps![0].step).toBe("Valid step");
    });

    it("throws on missing recipe name", async () => {
      mockRecipe.name = "";

      await expect(
        parseTandoorRecipeToDTO(mockRecipe, "123e4567-e89b-42d3-a456-426614174000")
      ).rejects.toThrow("Missing recipe name");
    });
  });

  describe("extractTandoorRecipes", () => {
    it("extracts recipes from nested zip structure", async () => {
      // Create a nested zip with recipe.json
      const nestedZip = new JSZip();

      nestedZip.file(
        "recipe.json",
        JSON.stringify({
          name: "Test Recipe",
          description: "Test description",
          keywords: [{ name: "test" }],
          steps: [],
          working_time: 10,
          waiting_time: 20,
          servings: 2,
          source_url: "https://example.com",
        })
      );

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      // Create main zip with nested zip
      const mainZip = new JSZip();

      mainZip.file("recipe_1.zip", nestedZipBuffer);

      const results = await extractTandoorRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Test Recipe");
      expect(results[0].fileName).toBe("recipe_1.zip");
      expect(results[0].image).toBeUndefined();
    });

    it("extracts recipe with image", async () => {
      // Create a nested zip with recipe.json and image.png
      const nestedZip = new JSZip();

      nestedZip.file(
        "recipe.json",
        JSON.stringify({
          name: "Recipe with Image",
          steps: [],
        })
      );
      nestedZip.file("image.png", Buffer.from("fake-png-data"));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      // Create main zip
      const mainZip = new JSZip();

      mainZip.file("recipe_with_image.zip", nestedZipBuffer);

      const results = await extractTandoorRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Recipe with Image");
      expect(results[0].image).toBeInstanceOf(Buffer);
      expect(results[0].image?.toString()).toBe("fake-png-data");
    });

    it("handles multiple nested zips", async () => {
      const mainZip = new JSZip();

      // Create first nested zip
      const zip1 = new JSZip();

      zip1.file("recipe.json", JSON.stringify({ name: "Recipe 1", steps: [] }));
      const zip1Buffer = await zip1.generateAsync({ type: "nodebuffer" });

      mainZip.file("recipe_1.zip", zip1Buffer);

      // Create second nested zip
      const zip2 = new JSZip();

      zip2.file("recipe.json", JSON.stringify({ name: "Recipe 2", steps: [] }));
      const zip2Buffer = await zip2.generateAsync({ type: "nodebuffer" });

      mainZip.file("recipe_2.zip", zip2Buffer);

      const results = await extractTandoorRecipes(mainZip);

      expect(results).toHaveLength(2);
      expect(results[0].recipe.name).toBe("Recipe 1");
      expect(results[1].recipe.name).toBe("Recipe 2");
    });

    it("throws on nested zip without recipe.json", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("wrong-file.txt", "not a recipe");

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("bad_recipe.zip", nestedZipBuffer);

      await expect(extractTandoorRecipes(mainZip)).rejects.toThrow(
        "No recipe.json found in nested zip"
      );
    });

    it("throws on invalid recipe.json", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", "invalid json{");

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("invalid_recipe.zip", nestedZipBuffer);

      await expect(extractTandoorRecipes(mainZip)).rejects.toThrow("Failed to parse");
    });

    it("finds image with different extensions", async () => {
      const testExtensions = ["image.jpg", "image.png", "image.jpeg", "image.webp"];

      for (const imageName of testExtensions) {
        const nestedZip = new JSZip();

        nestedZip.file("recipe.json", JSON.stringify({ name: "Test", steps: [] }));
        nestedZip.file(imageName, Buffer.from("image-data"));

        const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

        const mainZip = new JSZip();

        mainZip.file("test.zip", nestedZipBuffer);

        const results = await extractTandoorRecipes(mainZip);

        expect(results[0].image).toBeInstanceOf(Buffer);
      }
    });
  });
});
