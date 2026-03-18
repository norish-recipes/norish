import { z } from "zod";

/**
 * Measurement system enum.
 */
export const measurementSystemSchema = z.enum(["metric", "us"]);

export type MeasurementSystem = z.infer<typeof measurementSystemSchema>;

/**
 * Converted ingredient with target measurement system.
 *
 * NOTE: .strict() is required for OpenAI structured output compatibility.
 * OpenAI requires additionalProperties: false on ALL objects in the schema.
 */
export const convertedIngredientSchema = z
  .object({
    ingredientName: z.string().describe("Name of the ingredient"),
    amount: z.number().nullable().describe("Quantity in the target measurement system"),
    unit: z.string().nullable().describe("Unit in the target measurement system"),
    systemUsed: measurementSystemSchema.describe("The measurement system used"),
    order: z.number().describe("Order of the ingredient in the recipe"),
  })
  .strict();

/**
 * Converted step with target measurement system.
 *
 * NOTE: .strict() is required for OpenAI structured output compatibility.
 * OpenAI requires additionalProperties: false on ALL objects in the schema.
 */
export const convertedStepSchema = z
  .object({
    step: z.string().describe("Instruction text with converted measurements"),
    systemUsed: measurementSystemSchema.describe("The measurement system used"),
    order: z.number().describe("Order of the step in the recipe"),
  })
  .strict();

/**
 * Schema for unit conversion between metric and US measurement systems.
 *
 * NOTE: .strict() is required for OpenAI structured output compatibility.
 * OpenAI requires additionalProperties: false on ALL objects in the schema.
 */
export const conversionSchema = z
  .object({
    ingredients: z
      .array(convertedIngredientSchema)
      .describe("Ingredients converted to the target measurement system"),
    steps: z
      .array(convertedStepSchema)
      .describe("Steps with measurements converted to the target system"),
  })
  .strict();

export type ConversionOutput = z.infer<typeof conversionSchema>;
export type ConvertedIngredient = z.infer<typeof convertedIngredientSchema>;
export type ConvertedStep = z.infer<typeof convertedStepSchema>;
