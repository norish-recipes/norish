export const jsonLdRecipeSchema = {
  name: "schema_org_recipe_dual_system",
  schema: {
    type: "object",
    properties: {
      "@context": {
        type: "string",
        const: "https://schema.org",
      },
      "@type": {
        type: "string",
        const: "Recipe",
      },
      name: { type: "string" },
      description: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      recipeYield: {
        anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
      },
      prepTime: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      cookTime: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      totalTime: {
        anyOf: [{ type: "string" }, { type: "null" }],
      },
      recipeIngredient: {
        type: "object",
        properties: {
          metric: {
            type: "array",
            items: { type: "string" },
          },
          us: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["metric", "us"],
        additionalProperties: false,
      },
      recipeInstructions: {
        type: "object",
        properties: {
          metric: {
            type: "array",
            items: { type: "string" },
          },
          us: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["metric", "us"],
        additionalProperties: false,
      },
      keywords: {
        anyOf: [
          { type: "array", items: { type: "string" } },
          { type: "null" },
        ],
      },
    },
    required: [
      "@context",
      "@type",
      "name",
      "description",
      "recipeYield",
      "prepTime",
      "cookTime",
      "totalTime",
      "recipeIngredient",
      "recipeInstructions",
      "keywords",
    ],
    additionalProperties: false,
  },
  strict: true,
} as const;
