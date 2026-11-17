/** A count's label around the formatted number: only the number rolls. Null where the label does not
 * hold the number once, and then the whole label is shown as it is. */
export function aroundCount(label: string, formatted: string): [string, string] | null {
  const parts = label.split(formatted);

  return parts.length === 2 ? [parts[0] ?? "", parts[1] ?? ""] : null;
}
