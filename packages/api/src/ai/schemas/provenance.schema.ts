import { z } from "zod";

/**
 * Recipe Provenance as the model returns it.
 *
 * Built by a function rather than exported as a constant because the Cuisine
 * half of the claim has to be described from the administrator's current
 * vocabulary, which is a runtime value and never a compile-time enum.
 */
export function buildProvenanceSchema() {
  return z
    .object({
      originCountry: z
        .string()
        .nullable()
        .describe(
          "ISO-3166-1 alpha-2 code of the country this dish comes from, e.g. IT. Never a country name. Null if no single country fits."
        ),
      originRegion: z
        .string()
        .nullable()
        .describe(
          "Region within that country when the dish clearly warrants one, e.g. Sicily. Null for a national dish. Not translated."
        ),
      provenanceNote: z
        .string()
        .describe(
          "Two or three sentences explaining the conclusion, written in the language the recipe itself is written in."
        ),
    })
    .strict();
}

export type ProvenanceInference = z.infer<ReturnType<typeof buildProvenanceSchema>>;
