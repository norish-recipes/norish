/** Whether a label fits in `room` pt beside its `chrome` (icon, gaps, padding); null until both
 * widths are measured, while the label stays hidden. */
export function labelFits(room: number | null, labelWidth: number | null, chrome: number) {
  if (room === null || labelWidth === null) return null;

  return labelWidth + chrome <= room;
}
