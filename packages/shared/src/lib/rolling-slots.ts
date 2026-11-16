/** The value as slots, padded to `slots` with empty ones on the side it grows from: the end for a
 * word, the start for a number. */
export function toSlots(value: string, slots: number | undefined, keyFrom: "left" | "right") {
  const characters = [...value];
  const padding = Math.max(0, (slots ?? characters.length) - characters.length);
  const blanks = Array.from({ length: padding }, () => " ");

  return keyFrom === "right" ? [...blanks, ...characters] : [...characters, ...blanks];
}
