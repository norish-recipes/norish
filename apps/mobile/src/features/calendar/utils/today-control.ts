/** Which way today lies from the days on screen, or null where its card is shown (or unknown):
 * the rule that says when the Today control appears. */
export function todayDirection(
  shownDays: readonly string[],
  todayKey: string,
  todayInRows: boolean
): "up" | "down" | null {
  if (!todayInRows || shownDays.length === 0 || shownDays.includes(todayKey)) return null;

  return (shownDays[0] ?? "") > todayKey ? "up" : "down";
}
