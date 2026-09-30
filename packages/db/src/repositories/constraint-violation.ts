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
