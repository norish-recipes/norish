/**
 * Client-to-canonical id substitution contract (ADR-0009).
 *
 * A create-style mutation that may merge client-minted rows into existing
 * canonical rows reports one substitution per submitted item, in input
 * order, under the well-known `idSubstitutions` field of its result. Outbox
 * Replay reads that field generically — without switching on a procedure
 * name — and rewrites exact matching UUID values in later queued inputs and
 * dependency metadata.
 */

export type IdSubstitution = {
  /** The id the client minted for the submitted item. */
  clientId: string;
  /** The id the server settled on: the merged-into row or the client id itself. */
  canonicalId: string;
};

export const ID_SUBSTITUTIONS_FIELD = "idSubstitutions" as const;

function isIdSubstitution(value: unknown): value is IdSubstitution {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return typeof candidate.clientId === "string" && typeof candidate.canonicalId === "string";
}

/**
 * Read the substitution list out of an arbitrary mutation result. Returns an
 * empty list unless the result carries a well-formed `idSubstitutions` array.
 */
export function extractIdSubstitutions(result: unknown): IdSubstitution[] {
  if (typeof result !== "object" || result === null || Array.isArray(result)) return [];

  const field = (result as Record<string, unknown>)[ID_SUBSTITUTIONS_FIELD];

  if (!Array.isArray(field)) return [];

  return field.every(isIdSubstitution) ? field : [];
}
