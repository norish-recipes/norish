import { z } from "zod";

/**
 * Schema for AI-based auto-tagging.
 * Returns an array of tag strings.
 */
export const autoTaggingSchema = z
  .object({
    tags: z
      .array(z.string())
      .describe("Array of lowercase tag strings max 10. Tags should be concise 1-3 words each."),
  })
  .strict();

export type AutoTaggingOutput = z.infer<typeof autoTaggingSchema>;
