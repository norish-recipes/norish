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
    originCountry: z.string().length(2).toUpperCase().describe("ISO-3166-1 alpha-2 country code (e.g., IT, US, JP)"),
    originRegion: z.string().nullable().describe("Specific region or state if applicable"),
    cuisines: z.array(z.enum(CUISINE_STYLES)).describe("Primary cuisines. Can be multiple for fusion dishes."),
    provenanceNote: z.string().describe("Descriptive note about why this provenance was inferred. Mention fusion or style nuances here."),
  })
  .strict();

export type ProvenanceInferenceOutput = z.infer<typeof provenanceInferenceSchema>;
