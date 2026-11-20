const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

/**
 * TanStack Query's structural sharing, with two Dates equal when they hold the same time: its own
 * compares a Date by identity, so every refetch of a read with Dates (superjson's, nearly every
 * read) made every object in it new and re-rendered everything that shows it.
 */
export function shareEqual(previous: unknown, next: unknown): unknown {
  if (previous === next) return previous;
  if (previous instanceof Date && next instanceof Date) {
    return previous.getTime() === next.getTime() ? previous : next;
  }

  const arrays = Array.isArray(previous) && Array.isArray(next);

  if (!arrays && !(isPlainObject(previous) && isPlainObject(next))) return next;

  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  const keys = Object.keys(after);
  const shared: Record<string, unknown> = arrays ? ([] as unknown as Record<string, unknown>) : {};
  let same = keys.length === Object.keys(before).length;

  for (const key of keys) {
    shared[key] = shareEqual(before[key], after[key]);
    if (shared[key] !== before[key] || !(key in before)) same = false;
  }

  return same ? previous : shared;
}
