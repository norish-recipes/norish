import JSZip from "jszip";

/**
 * One sheet of an .xlsx workbook as rows of text cells, by its name. Only
 * what the CIQUAL and CoFID workbooks use: shared and inline strings and
 * plain values; no formulas are evaluated (a cached value is read as is).
 */
export async function readSheet(file: Uint8Array, sheetName: string): Promise<string[][]> {
  const zip = await JSZip.loadAsync(file);
  const workbook = await text(zip, "xl/workbook.xml");
  const relations = await text(zip, "xl/_rels/workbook.xml.rels");
  const sheet = [...workbook.matchAll(/<sheet\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => decode(attribute(tag, "name") ?? "") === sheetName);

  if (!sheet) throw new Error(`The workbook has no sheet named "${sheetName}"`);

  const relationId = attribute(sheet, "r:id");
  const target = [...relations.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => attribute(tag, "Id") === relationId);
  const path = target ? attribute(target, "Target") : null;

  if (!path) throw new Error(`The workbook does not say where sheet "${sheetName}" is`);

  const strings = zip.file("xl/sharedStrings.xml")
    ? sharedStrings(await text(zip, "xl/sharedStrings.xml"))
    : [];

  return cells(await text(zip, path.startsWith("/") ? path.slice(1) : `xl/${path}`), strings);
}

/** The names of a workbook's sheets, in order. */
export async function sheetNames(file: Uint8Array): Promise<string[]> {
  const workbook = await text(await JSZip.loadAsync(file), "xl/workbook.xml");

  return [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((match) =>
    decode(attribute(match[0], "name") ?? "")
  );
}

async function text(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);

  if (!entry) throw new Error(`The workbook has no ${path}`);

  return await entry.async("string");
}

function attribute(tag: string, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

function decode(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** The text of every `<t>` in a string item, run after run. */
function itemText(item: string): string {
  return [...item.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => decode(match[1]!))
    .join("");
}

function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => itemText(match[1]!));
}

/** "AB12" → 27 (zero-based column index). */
function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "A";

  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function cells(xml: string, strings: readonly string[]): string[][] {
  const rows: string[][] = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];

    for (const cellMatch of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1]!;
      const body = cellMatch[2] ?? "";
      const reference = attribute(` ${attributes}`, "r");
      const type = attribute(` ${attributes}`, "t");
      const index = reference ? columnIndex(reference) : row.length;
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";

      if (type === "s" && raw !== undefined) value = strings[Number(raw)] ?? "";
      else if (type === "inlineStr") value = itemText(body);
      else if (raw !== undefined) value = decode(raw);

      while (row.length < index) row.push("");
      row[index] = value;
    }
    rows.push(row);
  }

  return rows;
}
