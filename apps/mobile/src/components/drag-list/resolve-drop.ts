export type DragRow<H, T> =
  { kind: "heading"; key: string; value: H } | { kind: "item"; key: string; value: T };

export type Drop<H, T> = {
  item: T;
  /** The heading row above where the item landed, or null above the first heading. */
  heading: H | null;
  /** The rows in their new order. */
  rows: DragRow<H, T>[];
};

export function resolveDrop<H, T>(
  rows: DragRow<H, T>[],
  from: number,
  to: number
): Drop<H, T> | null {
  const moved = rows[from];

  if (moved?.kind !== "item") return null;

  const next = [...rows];
  const [row] = next.splice(from, 1);

  next.splice(to, 0, row);

  const above = next.slice(0, to).findLast((r) => r.kind === "heading");

  return { item: moved.value, heading: above?.value ?? null, rows: next };
}
