/**
 * Draw a handful of chosen foods at both tiers into one contact sheet, on a
 * light and a dark ground, for the icon style and tier to be approved before
 * the full set is drawn:
 *
 *   pnpm --filter @norish/ingredient-icons-tool draw-sample-icons [--out <dir>]
 *
 * The sheet is rewritten after each food, so it can be watched as it fills.
 * It draws into the sheet only: nothing reaches the set or an instance.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { listIconCatalogue } from "@norish/db/repositories/ingredient-icons";
import { ICON_SIZE } from "@norish/shared-server/media/ingredient-icon";

import { drawIcon, flag, run, say, seededFoods } from "./drawing";

/**
 * The sample sheet's foods: everyday ones, and the ones a style most often
 * gets wrong: pale foods, liquids, powders, spices, cuts of meat.
 */
const SAMPLE = [
  "en:onion",
  "en:garlic",
  "en:tomato",
  "en:carrot",
  "en:cauliflower",
  "en:egg",
  "en:milk",
  "en:olive-oil",
  "en:soy-sauce",
  "en:wheat-flour",
  "en:sugar",
  "en:salt",
  "en:black-pepper",
  "en:cumin",
  "en:cinnamon",
  "en:basil",
  "en:chicken-breast",
  "en:beef-steak",
  "en:salmon",
  "en:parmigiano-reggiano",
];

const CELL = 160;
const LABEL = 220;
const HEADER = 44;
const COLUMNS = [
  { tier: "low", ground: "#f4f4f5" },
  { tier: "medium", ground: "#f4f4f5" },
  { tier: "low", ground: "#18181b" },
  { tier: "medium", ground: "#18181b" },
] as const;

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

type SheetRow = { offId: string; icons: Partial<Record<ImageTier, Buffer>> };

/** The contact sheet: each food's row at both tiers, on a light and a dark ground. */
async function writeSheet(rows: readonly SheetRow[], file: string): Promise<void> {
  const width = LABEL + COLUMNS.length * CELL;
  const height = HEADER + rows.length * CELL;
  const text = (x: number, y: number, body: string, fill = "#18181b") =>
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="15" fill="${fill}">${escape(body)}</text>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    ...COLUMNS.map((column, index) =>
      text(LABEL + index * CELL + 12, 28, `${column.tier}, ${index < 2 ? "light" : "dark"}`)
    ),
    ...rows.flatMap((row, index) => [
      text(12, HEADER + index * CELL + CELL / 2, row.offId),
      ...COLUMNS.map(
        (column, at) =>
          `<rect x="${LABEL + at * CELL}" y="${HEADER + index * CELL}" width="${CELL}" height="${CELL}" fill="${column.ground}"/>`
      ),
    ]),
    `</svg>`,
  ].join("");
  const inset = (CELL - ICON_SIZE) / 2;
  const sheet = await sharp(Buffer.from(svg))
    .composite(
      rows.flatMap((row, index) =>
        COLUMNS.flatMap((column, at) => {
          const icon = row.icons[column.tier];

          return icon
            ? [{ input: icon, left: LABEL + at * CELL + inset, top: HEADER + index * CELL + inset }]
            : [];
        })
      )
    )
    .png()
    .toBuffer();

  await writeFile(file, sheet);
}

run(async () => {
  const out = flag("--out") ?? join(process.cwd(), "out");
  const seeded = seededFoods(await listIconCatalogue());
  const file = join(out, "sample-sheet.png");
  const rows: SheetRow[] = [];

  await mkdir(out, { recursive: true });
  say(`Drawing the sample into ${file}`);
  for (const offId of SAMPLE) {
    const id = seeded.get(offId);
    const icons: Partial<Record<ImageTier, Buffer>> = {};

    for (const tier of ["low", "medium"] as const) {
      if (!id) break;
      try {
        icons[tier] = await drawIcon(id, tier);
        say(`drew ${offId} at ${tier}`);
      } catch (error) {
        say(`FAILED ${offId} at ${tier}: ${error instanceof Error ? error.message : error}`);
      }
    }
    if (!id) say(`skipped ${offId}: not in this catalogue`);
    rows.push({ offId, icons });
    await writeSheet(rows, file);
  }
  say(`Wrote ${file}`);
});
