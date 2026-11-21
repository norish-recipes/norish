import { z } from "zod";

export const parserHealthSchema = z.object({
  status: z.string().optional(),
  recipeScrapersVersion: z.string().optional(),
});

/** The parser as the liveness and readiness checks report it. */
const reportedParserSchema = z.object({
  status: z.string(),
  statusCode: z.number().optional(),
  recipeScrapersVersion: z.string().optional(),
});

export const liveResponseSchema = z.object({
  status: z.literal("ok"),
  parser: reportedParserSchema,
});

export const readyResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().describe("The running Norish version, e.g. 0.27.0-beta."),
  db: z.object({ status: z.literal("ok") }),
  valkey: z.object({ status: z.literal("ok") }),
  parser: reportedParserSchema,
});
