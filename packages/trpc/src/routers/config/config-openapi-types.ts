import { z } from "zod";

export const parserHealthSchema = z.object({
  status: z.string().optional(),
  recipeScrapersVersion: z.string().optional(),
});

export const healthyResponseSchema = z.object({
  status: z.literal("ok"),
  parser: z.object({
    status: z.literal("ok"),
    recipeScrapersVersion: z.string().optional(),
  }),
});
