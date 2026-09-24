import { z } from "zod";

import type { CuisineStrategy } from "@norish/config/zod/server-config";

/** What the model proposes: Cuisines are still names, not vocabulary rows. */
export interface ProposedProvenance {
  /** Absent when a Decision settled the country before the request (ADR-0035). */
  originCountry?: string | null;
  originCountryName: string | null;
  originRegion: string | null;
  /** Absent when a Decision settled the Cuisines before the request. */
  cuisines?: string[];
  provenanceNote: string;
}

/** The slots a Decision settled, which the language model is not asked for. */
export interface SettledProvenanceSlots {
  country?: boolean;
  cuisines?: boolean;
}

/**
 * Recipe Provenance as the model returns it.
 *
 * Built by a function rather than exported as a constant because the Cuisine
 * half of the claim is described from the administrator's current vocabulary,
 * which is a runtime value and never a compile-time enum (ADR-0012), and
 * because a slot a Decision has already settled is dropped from the request:
 * the model writes the region and the note around it rather than answering
 * it again (ADR-0018's gap-fill shape, ADR-0035).
 */
export function buildProvenanceSchema(
  vocabulary: readonly string[],
  strategy: CuisineStrategy,
  settled: SettledProvenanceSlots = {}
): z.ZodType<ProposedProvenance> {
  const known = vocabulary.length > 0 ? vocabulary.join(", ") : "(none configured)";
  // Under `extend` the administrator has opted in to AI adding to the
  // vocabulary, so the model has to be told it may propose a name. Under
  // `existing` it must not be, or every unmatched proposal is simply discarded.
  const unlisted =
    strategy === "extend"
      ? "If none of them fits, name the tradition it does belong to instead."
      : "Use an empty array when none of them fits.";

  const originCountry = z
    .string()
    .nullable()
    .describe(
      "ISO-3166-1 alpha-2 code of the single country with the strongest claim to this dish, e.g. IT. Never a country name. When several countries claim the dish, still pick the strongest claim and acknowledge the rivals in the note. Null only when the dish belongs to no national tradition at all."
    );
  const cuisines = z.array(z.string()).describe(
    // The names are pinned to the vocabulary's language here as well as in
    // the prompt: models bleed the note's language across fields, and a
    // translated name mints a duplicate row under the extending strategy.
    `Culinary traditions this dish belongs to, from this list: ${known}. Use several only for a genuine fusion dish. ${unlisted} Names taken from the list must be copied verbatim, never translated, whatever language the note is written in.`
  );

  const originCountryName = z
    .string()
    .nullable()
    .describe(
      "That country's name written in the language the recipe itself is written in — the same language as the note, e.g. Turkije in a Dutch recipe about a Turkish dish. Null exactly when originCountry is null."
    );
  const originRegion = z
    .string()
    .nullable()
    .describe(
      "Region within that country when the dish clearly warrants one, e.g. Sicily. Null for a national dish. Not translated."
    );
  const provenanceNote = z
    .string()
    .describe(
      "Two or three sentences explaining the conclusion, written in the language the recipe itself is written in."
    );

  // Spelled out per case rather than spread conditionally, so the output type
  // stays what the caller reads rather than collapsing to unknown.
  const common = { originCountryName, originRegion, provenanceNote };

  if (settled.country && settled.cuisines) return z.object(common).strict();
  if (settled.country) return z.object({ ...common, cuisines }).strict();
  if (settled.cuisines) return z.object({ ...common, originCountry }).strict();

  return z.object({ ...common, originCountry, cuisines }).strict();
}
