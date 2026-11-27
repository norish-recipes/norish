/** A standard segment's side inset, which a label's room is measured against. */
export const STANDARD_INSET = 8;

/** The scale at which every label fits its segment, from each label's semibold width, its frame
 * and its segment's. The content is centred, so what precedes a label is the same at any size. */
export function sharedLabelScale<Value extends string>(
  segments: readonly { value: Value }[],
  natural: Partial<Record<Value, number>>,
  labels: Partial<Record<Value, { x: number; width: number }>>,
  boxes: Partial<Record<Value, { width: number }>>
) {
  return Math.min(
    1,
    ...segments.map(({ value }) => {
      const full = natural[value];
      const label = labels[value];
      const frame = boxes[value];

      if (!full || !label || !frame) return 1;
      const lead = 2 * label.x + label.width - frame.width;

      return (frame.width - 2 * STANDARD_INSET - lead) / full;
    })
  );
}
