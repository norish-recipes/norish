import { z } from "zod";

export const RecipeScrapersParserRequestSchema = z.object({
  url: z.url(),
  html: z.string().min(1),
});

export const RecipeScrapersParserMetadataSchema = z.object({
  mode: z.enum(["supported", "wild"]),
  scraper: z.string(),
  host: z.string().nullish(),
  siteName: z.string().nullish(),
  version: z.string(),
});

export const RecipeScrapersParserVideoSchema = z.object({
  contentUrl: z.url().nullish(),
  url: z.url().nullish(),
  thumbnailUrl: z.union([z.url(), z.array(z.url())]).nullish(),
  duration: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
});

export const RecipeScrapersParserFailureCodeSchema = z.enum([
  "WebsiteNotImplementedError",
  "NoSchemaFoundInWildMode",
  "RecipeSchemaNotFound",
  "ParserError",
]);

export const RecipeScrapersParserSuccessSchema = z.object({
  ok: z.literal(true),
  canonicalUrl: z.url().nullish(),
  parser: RecipeScrapersParserMetadataSchema,
  recipe: z.record(z.string(), z.unknown()),
  media: z.object({
    images: z.array(z.url()).default([]),
    videos: z.array(RecipeScrapersParserVideoSchema).default([]),
  }),
});

export const RecipeScrapersParserFailureSchema = z.object({
  ok: z.literal(false),
  error: RecipeScrapersParserFailureCodeSchema,
  message: z.string(),
  parser: RecipeScrapersParserMetadataSchema.nullish(),
});

export const RecipeScrapersParserResponseSchema = z.discriminatedUnion("ok", [
  RecipeScrapersParserSuccessSchema,
  RecipeScrapersParserFailureSchema,
]);

export type RecipeScrapersParserRequest = z.infer<typeof RecipeScrapersParserRequestSchema>;
export type RecipeScrapersParserFailureCode = z.infer<typeof RecipeScrapersParserFailureCodeSchema>;
export type RecipeScrapersParserSuccess = z.infer<typeof RecipeScrapersParserSuccessSchema>;
export type RecipeScrapersParserFailure = z.infer<typeof RecipeScrapersParserFailureSchema>;
export type RecipeScrapersParserResponse = z.infer<typeof RecipeScrapersParserResponseSchema>;
