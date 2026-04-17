import { z } from "zod";

export const parserHealthSchema = z.object({
  status: z.string().optional(),
  recipeScrapersVersion: z.string().optional(),
});

export const healthyResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.object({
    status: z.literal("ok"),
  }),
  versions: z.object({
    app: z.string(),
    web: z.string(),
    mobile: z.string(),
    scraper: z.string().optional(),
  }),
  parser: z.object({
    status: z.literal("ok"),
    recipeScrapersVersion: z.string().optional(),
  }),
});
