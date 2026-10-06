/**
 * Draw the Ingredient Icons Norish ships for its seeded foods, through the
 * image provider and icon Prompt of the instance whose database the
 * environment names, so the shipped style is what an instance draws and the
 * AI boundary gets no second provider client:
 *
 *   pnpm --filter @norish/ingredient-icons-tool draw sample [--out <dir>]
 *   pnpm --filter @norish/ingredient-icons-tool draw full [--tier low|medium] [--limit n] [--concurrency 1] [--yes]
 *
 * `sample` draws a handful of chosen foods at both tiers into one contact
 * sheet, on a light and a dark ground, for the style and tier to be approved.
 * `full` draws every seeded food not on the vague-groups list and not drawn
 * already, so a stopped run resumes where it stopped: it says how many first,
 * and draws only with `--yes`, one at a time unless `--concurrency` says
 * more (as many as the provider's rate limit allows; a refusal for the rate
 * limit is waited out). Each icon is written as it lands, with the
 * manifest; the provider's 1024px originals are never kept. Failures are
 * listed at the end and left to borrow, or to the next run.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { resetDbConnection } from "@norish/db/drizzle";
import { countRecipeUses, listIconCatalogue } from "@norish/db/repositories/ingredient-icons";
import { drawIngredientIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { foodToDraw } from "@norish/shared-server/ingredients/icon-drafts";
import {
  ICON_SIZE,
  iconFileName,
  iconSetDir,
  makeIngredientIcon,
} from "@norish/shared-server/media/ingredient-icon";

import { VAGUE_GROUPS } from "./vague-groups";

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

interface Manifest {
  icons: Record<string, string>;
  none: string[];
}

function say(...parts: unknown[]): void {
  process.stdout.write(`${parts.map(String).join(" ")}\n`);
}

function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name);

  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** A seeded food: one the catalogue seed wrote, ownerless and named for an Open Food Facts entry. */
async function seededFoods(): Promise<Map<string, string>> {
  const nodes = await listIconCatalogue();

  return new Map(
    [...nodes.values()].flatMap((node) =>
      node.offId && node.ownerId === null ? [[node.offId, node.id] as const] : []
    )
  );
}

/** Draw one food at a tier and make it an icon. */
async function drawIcon(ingredientId: string, tier: ImageTier): Promise<Buffer> {
  const food = await foodToDraw(ingredientId);

  if (!food) throw new Error(`Ingredient ${ingredientId} is gone`);

  return await makeIngredientIcon((await drawIngredientIcon(food, tier)).bytes);
}

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

/**
 * The sample: every chosen food at both tiers, into a contact sheet that is
 * rewritten after each food, so it can be watched as it fills. It draws into
 * the sheet only: nothing reaches the set or an instance.
 */
async function sample(out: string): Promise<void> {
  const seeded = await seededFoods();
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
}

async function readManifest(): Promise<Manifest> {
  try {
    return JSON.parse(await readFile(join(iconSetDir(), "manifest.json"), "utf-8")) as Manifest;
  } catch {
    return { icons: {}, none: [] };
  }
}

/** The manifest as the server reads it, sorted, so a run's diff is the icons it drew. */
async function writeManifest(manifest: Manifest): Promise<void> {
  const icons = Object.fromEntries(
    Object.entries(manifest.icons).sort(([a], [b]) => (a < b ? -1 : 1))
  );
  const none = [...manifest.none].sort();

  await writeFile(
    join(iconSetDir(), "manifest.json"),
    `${JSON.stringify({ icons, none }, null, 2)}\n`
  );
}

/**
 * The full set: every seeded food not vague and not drawn yet, written as it
 * lands. The foods this instance's recipes use most come first, so a run cut
 * short, or one told to stop after `limit`, has drawn the icons readers meet.
 */
async function full(
  tier: ImageTier,
  concurrency: number,
  limit: number,
  confirmed: boolean
): Promise<void> {
  const [seeded, uses] = await Promise.all([seededFoods(), countRecipeUses()]);
  const manifest = await readManifest();
  const vague = new Set(VAGUE_GROUPS);
  const left = [...seeded]
    .filter(([offId]) => !vague.has(offId) && !manifest.icons[offId])
    .sort(([a, idA], [b, idB]) => (uses.get(idB) ?? 0) - (uses.get(idA) ?? 0) || (a < b ? -1 : 1));
  const todo = left.slice(0, limit);

  say(
    `${todo.length} icons to draw at ${tier}${todo.length < left.length ? `, the first of ${left.length} left` : ""} (${seeded.size} seeded foods, ${Object.keys(manifest.icons).length} drawn, ${vague.size} vague groups).`
  );
  if (!confirmed) {
    say("Run again with --yes to draw them.");

    return;
  }

  manifest.none = [...VAGUE_GROUPS];
  for (const offId of Object.keys(manifest.icons)) {
    if (vague.has(offId)) delete manifest.icons[offId];
  }
  await mkdir(join(iconSetDir(), "icons"), { recursive: true });

  const failed: string[] = [];
  let next = 0;
  let done = 0;
  // One manifest write at a time: drawings land in any order.
  let saving = Promise.resolve();

  const drawNext = async () => {
    while (next < todo.length) {
      const [offId, id] = todo[next++]!;

      try {
        const icon = await drawIcon(id, tier);
        const file = iconFileName(icon);

        await writeFile(join(iconSetDir(), "icons", file), icon);
        manifest.icons[offId] = file;
        saving = saving.then(() => writeManifest(manifest));
        await saving;
        say(`${++done}/${todo.length} ${offId}`);
      } catch (error) {
        failed.push(offId);
        say(
          `${++done}/${todo.length} FAILED ${offId}: ${error instanceof Error ? error.message : error}`
        );
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, drawNext));
  await saving;
  await writeManifest(manifest);
  say(`Done: ${todo.length - failed.length} drawn, ${failed.length} failed.`);
  if (failed.length > 0)
    say(`Failed (run again to retry, or leave them to borrow): ${failed.join(", ")}`);
}

async function main(): Promise<void> {
  const mode = process.argv[2];

  if (mode === "sample") {
    await sample(flag("--out") ?? join(process.cwd(), "out"));
  } else if (mode === "full") {
    const tier = flag("--tier") ?? "low";

    // One at a time unless asked: a new account draws only a few images a minute.
    const concurrency = Number(flag("--concurrency") ?? 1);
    const limit = Number(flag("--limit") ?? Infinity);

    if (tier !== "low" && tier !== "medium") throw new Error(`Unknown tier: ${tier}`);
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error("--concurrency is a count");
    if (!(limit > 0)) throw new Error("--limit is a count");
    await full(tier, concurrency, limit, process.argv.includes("--yes"));
  } else {
    say(
      "Usage: draw sample [--out <dir>] | draw full [--tier low|medium] [--limit n] [--concurrency n] [--yes]"
    );
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : error}\n`);
    process.exitCode = 1;
  })
  .finally(() => resetDbConnection());
