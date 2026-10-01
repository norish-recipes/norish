/**
 * A delimited text file read into rows of cells: quotes, doubled quotes
 * inside them, and delimiters or line breaks inside quotes. Enough for the
 * USDA, CIQUAL and CALNUT exports, which are all plain RFC 4180 text.
 */
export function parseDelimited(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value !== ""));
}

/** Rows keyed by the header row's names. */
export function parseRecords(text: string, delimiter = ","): Array<Record<string, string>> {
  const [header, ...rows] = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter);

  if (!header) return [];

  return rows.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name.trim(), cells[index] ?? ""]))
  );
}
