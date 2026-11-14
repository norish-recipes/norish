export type DragRow<H, T> =
  { kind: "heading"; key: string; value: H } | { kind: "item"; key: string; value: T };

export type Drop<H, T> = {
  item: T;
  /** The heading row above where the item landed, or null above the first heading. */
  heading: H | null;
  /** The item's index in `rows`. */
  index: number;
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

  next.splice(to, 0, next.splice(from, 1)[0]!);

  let heading: H | null = null;

  for (const row of next.slice(0, to)) if (row.kind === "heading") heading = row.value;

  return { item: moved.value, heading, index: to, rows: next };
}
