import JSZip from "jszip";

/** A one-sheet workbook, as small as the reader needs: shared strings for every cell. */
export async function workbook(sheetName: string, rows: readonly string[][]): Promise<Uint8Array> {
  const strings: string[] = [];
  const escape = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const column = (index: number) => {
    let name = "";

    for (let rest = index + 1; rest > 0; rest = Math.floor((rest - 1) / 26)) {
      name = String.fromCharCode(65 + ((rest - 1) % 26)) + name;
    }

    return name;
  };
  const sheetRows = rows
    .map(
      (cells, row) =>
        `<row r="${row + 1}">${cells
          .map((cell, index) => {
            strings.push(cell);

            return `<c r="${column(index)}${row + 1}" t="s"><v>${strings.length - 1}</v></c>`;
          })
          .join("")}</row>`
    )
    .join("");
  const zip = new JSZip();

  zip.file(
    "xl/workbook.xml",
    `<workbook><sheets><sheet name="${escape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`
  );
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<worksheet><sheetData>${sheetRows}</sheetData></worksheet>`
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<sst>${strings.map((text) => `<si><t>${escape(text)}</t></si>`).join("")}</sst>`
  );

  return await zip.generateAsync({ type: "uint8array" });
}

/** A zip of CSV files under one folder, as USDA ships its downloads. */
export async function csvZip(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();

  for (const [name, text] of Object.entries(files)) zip.file(`FoodData_Central_csv/${name}`, text);

  return await zip.generateAsync({ type: "uint8array" });
}

/** CSV text from rows, every cell quoted as USDA writes it. */
export function csv(rows: readonly string[][]): string {
  return rows
    .map((cells) => cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** CIQUAL's header as the 2025 workbook spells it, line breaks and all. */
export const CIQUAL_HEADER = [
  "alim_code",
  "alim_nom_eng",
  "Energy,\r\nRegulation\r\nEU No\r\n1169\r\n2011 (kcal\r\n100g)",
  "Protein\r\n(g\r\n100g)",
  "Protein,\r\ncrude, N\r\nx 6.25 (g\r\n100g)",
  "Carbohydrate\r\n(g\r\n100g)",
  "Fat (g\r\n100g)",
];

/** The USDA files the reader reads, around a list of foods with their nutrients and portions. */
export async function usdaDownload(
  kind: "sr-legacy" | "foundation",
  foods: ReadonlyArray<{
    fdcId: string;
    ndb?: string;
    name: string;
    nutrients: Record<string, string>;
    portions?: ReadonlyArray<{ amount: string; unitId?: string; modifier: string; grams: string }>;
  }>
): Promise<Uint8Array> {
  return await csvZip({
    [kind === "sr-legacy" ? "sr_legacy_food.csv" : "foundation_food.csv"]: csv([
      ["fdc_id", "NDB_number"],
      ...foods.map((food) => [food.fdcId, food.ndb ?? ""]),
    ]),
    "food.csv": csv([
      ["fdc_id", "data_type", "description"],
      ...foods.map((food) => [food.fdcId, kind, food.name]),
    ]),
    "food_nutrient.csv": csv([
      ["id", "fdc_id", "nutrient_id", "amount"],
      ...foods.flatMap((food) =>
        Object.entries(food.nutrients).map(([id, amount], index) => [
          `${food.fdcId}${index}`,
          food.fdcId,
          id,
          amount,
        ])
      ),
    ]),
    "measure_unit.csv": csv([
      ["id", "name"],
      ["1000", "cup"],
      ["1001", "tablespoon"],
      ["1036", "medium"],
      ["9999", "undetermined"],
    ]),
    "food_portion.csv": csv([
      [
        "id",
        "fdc_id",
        "seq_num",
        "amount",
        "measure_unit_id",
        "portion_description",
        "modifier",
        "gram_weight",
      ],
      ...foods.flatMap((food) =>
        (food.portions ?? []).map((portion, index) => [
          `${food.fdcId}${index}`,
          food.fdcId,
          String(index + 1),
          portion.amount,
          portion.unitId ?? "9999",
          "",
          portion.modifier,
          portion.grams,
        ])
      ),
    ]),
  });
}
