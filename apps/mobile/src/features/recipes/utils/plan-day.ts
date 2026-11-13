/** The planned day: the picked one while it is still on the strip, else today (the strip's first day). */
export function planDay(picked: Date | null, days: readonly Date[]): Date {
  return days.find((day) => picked && day.getTime() === picked.getTime()) ?? days[0]!;
}
