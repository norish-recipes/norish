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
