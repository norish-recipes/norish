import { z } from "zod";

export const CUISINE_STYLES = [
  "American",
  "British",
  "Caribbean",
  "Chinese",
  "French",
  "Greek",
  "Indian",
  "Italian",
  "Japanese",
  "Korean",
  "Latin American",
  "Lebanese",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Spanish",
  "Thai",
  "Vietnamese",
  "Other"
] as const;

export const provenanceInferenceSchema = z
  .object({
    originCountry: z.string().length(2).toUpperCase(),
    originRegion: z.string().nullable(),
    cuisine: z.enum(CUISINE_STYLES).nullable(),
    provenanceNote: z.string(),
  })
  .strict();

export type ProvenanceInferenceOutput = z.infer<typeof provenanceInferenceSchema>;
