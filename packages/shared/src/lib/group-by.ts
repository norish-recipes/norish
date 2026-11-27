/** Rows grouped by `key` in the order first seen, each kept as `value` makes it (the row itself by default). */
export function groupBy<T, K>(rows: Iterable<T>, key: (row: T) => K): Map<K, T[]>;
export function groupBy<T, K, V>(
  rows: Iterable<T>,
  key: (row: T) => K,
  value: (row: T) => V
): Map<K, V[]>;
export function groupBy<T, K, V>(
  rows: Iterable<T>,
  key: (row: T) => K,
  value?: (row: T) => V
): Map<K, Array<T | V>> {
  const groups = new Map<K, Array<T | V>>();

  for (const row of rows) {
    const kept = value ? value(row) : row;
    const group = groups.get(key(row));

    if (group) group.push(kept);
    else groups.set(key(row), [kept]);
  }

  return groups;
}
