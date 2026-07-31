import { z } from "zod";

import type { CuisineStrategy } from "@norish/config/zod/server-config";

/**
 * Recipe Provenance as the model returns it.
 *
 * Built by a function rather than exported as a constant because the Cuisine
 * half of the claim is described from the administrator's current vocabulary,
 * which is a runtime value and never a compile-time enum (ADR-0012).
 */
export function buildProvenanceSchema(vocabulary: readonly string[], strategy: CuisineStrategy) {
  const known = vocabulary.length > 0 ? vocabulary.join(", ") : "(none configured)";
  // Under `extend` the administrator has opted in to AI adding to the
  // vocabulary, so the model has to be told it may propose a name. Under
  // `existing` it must not be, or every unmatched proposal is simply discarded.
  const unlisted =
    strategy === "extend"
      ? "If none of them fits, name the tradition it does belong to instead."
      : "Use an empty array when none of them fits.";

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
      cuisines: z.array(z.string()).describe(
        // The names are pinned to the vocabulary's language here as well as in
        // the prompt: models bleed the note's language across fields, and a
        // translated name mints a duplicate row under the extending strategy.
        `Culinary traditions this dish belongs to, from this list: ${known}. Use several only for a genuine fusion dish. ${unlisted} Names taken from the list must be copied verbatim, never translated, whatever language the note is written in.`
      ),
      provenanceNote: z
        .string()
        .describe(
          "Two or three sentences explaining the conclusion, written in the language the recipe itself is written in."
        ),
    })
    .strict();
}

/** What the model proposes: Cuisines are still names, not vocabulary rows. */
export type ProposedProvenance = z.infer<ReturnType<typeof buildProvenanceSchema>>;
