/** What Next needs beside its label: the chevron, the gap and a side padding each way. */
export const NEXT_CHROME = 20 + 6 + 2 * 8;

/** Whether Next's label fits its button; until both are measured it is shown. */
export function nextLabelFits(buttonWidth: number, labelWidth: number): boolean {
  return buttonWidth === 0 || labelWidth === 0 || labelWidth + NEXT_CHROME <= buttonWidth;
}
