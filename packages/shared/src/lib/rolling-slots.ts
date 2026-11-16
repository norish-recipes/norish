/** The value as slots, padded to `slots` with empty ones on the side it grows from: the end for a
 * word, the start for a number. */
export function toSlots(value: string, slots: number | undefined, keyFrom: "left" | "right") {
  const characters = [...value];
  const padding = Math.max(0, (slots ?? characters.length) - characters.length);
  const blanks = Array.from({ length: padding }, () => " ");

  return keyFrom === "right" ? [...blanks, ...characters] : [...characters, ...blanks];
}

/** The leading number of a formatted value, to tell which way it moved: 0 where there is none. */
export function valueMagnitude(value: string): number {
  const match = value.match(/-?\d+(?:[.,]\d+)?/);

  return match ? Number(match[0].replace(",", ".")) : 0;
}
