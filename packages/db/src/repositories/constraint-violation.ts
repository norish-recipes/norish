/**
 * Whether `error` is Postgres refusing a write on a constraint of this class:
 * `23505` a unique violation, `23503` a foreign-key one. Drizzle wraps the
 * driver's error, so its cause is read too.
 */
export function isConstraintViolation(error: unknown, code: "23505" | "23503"): boolean {
  for (let current = error; current && typeof current === "object";) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * Whether a write was refused because the Ingredient or alias it was handed
 * is gone: a foreign key onto `ingredients` or `ingredient_aliases` failed.
 */
export function isStaleIngredientReference(error: unknown): boolean {
  for (let current = error; current && typeof current === "object";) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };

    if (code === "23503" && typeof constraint === "string") {
      return /_(ingredients|ingredient_aliases)_id_fk$/.test(constraint);
    }
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** Whether a write was refused because the Store it points at is gone. */
export function isGoneStoreReference(error: unknown): boolean {
  for (let current = error; current && typeof current === "object";) {
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };

    if (code === "23503")
      return typeof constraint === "string" && constraint.endsWith("_store_id_stores_id_fk");
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** Thrown where a create finds its client-made id held by another account's row. */
export class TakenIdError extends Error {
  constructor() {
    super("Id is already taken");
  }
}

/** Whether a write was refused because its id is already taken: a client-made id another row holds. */
export function isPrimaryKeyCollision(error: unknown): boolean {
  for (let current = error; current && typeof current === "object";) {
    if (current instanceof TakenIdError) return true;
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };

    if (code === "23505") return typeof constraint === "string" && constraint.endsWith("_pkey");
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/** The owner-household trigger's refusal (migration 0090), and Postgres aborting a deadlock's victim. */
const RETRYABLE_SQLSTATES: unknown[] = ["NH001", "40P01"];

/** Whether a write was refused for a retry: its Owner's household moved, or it lost a deadlock. */
export function isRetryableConflict(error: unknown): boolean {
  for (let current = error; current && typeof current === "object";) {
    if (RETRYABLE_SQLSTATES.includes((current as { code?: unknown }).code)) return true;
    current = (current as { cause?: unknown }).cause;
  }

  return false;
}
