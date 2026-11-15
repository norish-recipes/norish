"use client";

interface AisleHeadingProps {
  aisleId: string;
  name: string;
  /** How many lines are filed under it: rows in the flat list, groups in the grouped one. */
  count: number;
}

/**
 * An Aisle's heading within a Store's card: the aisle's name and, where
 * something is filed under it, how much, slim enough that the list still
 * reads as a list. Rendered whether or not anything is filed under it, so
 * the shop's shape is always there to drag into; an empty one is quieter and
 * carries no count.
 */
export function AisleHeading({ aisleId, name, count }: AisleHeadingProps) {
  const empty = count === 0;

  return (
    <div
      className={`flex items-baseline gap-1.5 px-4 pt-2.5 pb-1 text-sm font-medium tracking-wide uppercase ${
        empty ? "text-muted/50" : "text-muted"
      }`}
      data-aisle-drop-target={aisleId}
      data-aisle-empty={empty}
      data-aisle-name={name}
      data-testid="aisle-heading"
    >
      <span className="truncate">{name}</span>
      {!empty && (
        <span className="tabular-nums" data-testid="aisle-count">
          {count}
        </span>
      )}
    </div>
  );
}
