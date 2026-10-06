/**
 * Draw the Ingredient Icons Norish ships for its seeded foods, through the
 * image provider and icon Prompt of the instance whose database the
 * environment names, so the shipped style is what an instance draws and the
 * AI boundary gets no second provider client:
 *
 *   pnpm --filter @norish/ingredient-icons-tool draw-icons [--tier low|medium] [--limit n] [--concurrency 1] [--yes]
 *
 * It first asks the instance's Decision Model, top-down, which seeded foods
 * would look like the icon they borrow anyway (every olive oil, one bottle),
 * remembering the answers in `shares.json` so no food is asked twice; those
 * borrow. It draws every other food not on the vague-groups list and not
 * drawn already, so a stopped run resumes where it stopped: it says how many
 * first, and draws only with `--yes`, one at a time unless `--concurrency`
 * says more (as many as the provider's rate limit allows; a refusal for the
 * rate limit is waited out). Each icon is written as it lands, with the
 * manifest; the provider's 1024px originals are never kept. Failures are
 * listed at the end and left to borrow, or to the next run.
 *
 * `draw-sample-icons` draws a contact sheet to approve the style first.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { IconNode } from "@norish/db/repositories/ingredient-icons";
import type { ImageTier } from "@norish/shared-server/ai/runtime/providers";
import { findLocaleNames } from "@norish/db/repositories/ingredient-aliases";
import { countRecipeUses, listIconCatalogue } from "@norish/db/repositories/ingredient-icons";
import { needsOwnIcon } from "@norish/shared-server/ai/enrichment/ingredient-icon-drawer";
import { iconFileName, iconSetDir } from "@norish/shared-server/media/ingredient-icon";

import { drawIcon, flag, run, say, seededFoods } from "./drawing";
import { VAGUE_GROUPS } from "./vague-groups";

interface Manifest {
  icons: Record<string, string>;
  none: string[];
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

/** Which seeded foods get an icon of their own ("draw") and which show their lender's ("borrow"), by Open Food Facts id. */
type Shares = Record<string, "draw" | "borrow">;

const SHARES = join(process.cwd(), "shares.json");

async function readShares(): Promise<Shares> {
  try {
    return JSON.parse(await readFile(SHARES, "utf-8")) as Shares;
  } catch {
    return {};
  }
}

async function writeShares(shares: Shares): Promise<void> {
  const sorted = Object.fromEntries(Object.entries(shares).sort(([a], [b]) => (a < b ? -1 : 1)));

  await writeFile(SHARES, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * Decide the seeded foods not decided or drawn yet, a level of the tree at
 * a time from the top, so each is asked against the icon it would really
 * show: its nearest ancestor that is drawn. A food with no such ancestor
 * (at the top, or under a vague group) is drawn without asking.
 */
async function decideShares(
  nodes: ReadonlyMap<string, IconNode>,
  seeded: ReadonlyMap<string, string>,
  manifest: Manifest,
  vague: ReadonlySet<string>
): Promise<Shares> {
  const shares = await readShares();
  const parent = (node: IconNode) => (node.parentId ? nodes.get(node.parentId) : undefined);
  const drawn = (node: IconNode) =>
    Boolean(node.offId && (manifest.icons[node.offId] || shares[node.offId] === "draw"));
  const lender = (node: IconNode) => {
    for (let up = parent(node); up; up = parent(up)) if (drawn(up)) return up;

    return undefined;
  };
  const depth = (node: IconNode) => {
    let levels = 0;

    for (let up = parent(node); up && levels < 64; up = parent(up)) levels++;

    return levels;
  };
  const undecided = [...seeded]
    .filter(([offId]) => !vague.has(offId) && !manifest.icons[offId] && !shares[offId])
    .map(([, id]) => nodes.get(id)!);

  if (undecided.length === 0) return shares;

  const names = await findLocaleNames([...nodes.keys()]);
  const nameOf = (node: IconNode) => names.get(node.id)?.en ?? node.name;
  const depths = new Map(undecided.map((node) => [node, depth(node)]));

  say(`Asking which of ${undecided.length} foods need an icon of their own…`);
  for (const level of [...new Set(depths.values())].sort((a, b) => a - b)) {
    const loans = undecided
      .filter((node) => depths.get(node) === level)
      .flatMap((node) => {
        const from = lender(node);

        if (!from) shares[node.offId!] = "draw";

        return from ? [{ node, food: nameOf(node), lender: nameOf(from) }] : [];
      });
    const own = await needsOwnIcon(loans);

    loans.forEach(({ node }, index) => (shares[node.offId!] = own[index] ? "draw" : "borrow"));
    await writeShares(shares);
  }

  return shares;
}

/**
 * The full set: every seeded food not vague, not drawn yet and not one that
 * borrows, written as it lands. The foods this instance's recipes use most come first, so a run cut
 * short, or one told to stop after `limit`, has drawn the icons readers meet.
 */
async function full(
  tier: ImageTier,
  concurrency: number,
  limit: number,
  confirmed: boolean
): Promise<void> {
  const [nodes, uses] = await Promise.all([listIconCatalogue(), countRecipeUses()]);
  const seeded = seededFoods(nodes);
  const manifest = await readManifest();
  const vague = new Set(VAGUE_GROUPS);
  const shares = await decideShares(nodes, seeded, manifest, vague);
  const borrowing = Object.values(shares).filter((share) => share === "borrow").length;
  const left = [...seeded]
    .filter(([offId]) => !vague.has(offId) && !manifest.icons[offId] && shares[offId] === "draw")
    .sort(([a, idA], [b, idB]) => (uses.get(idB) ?? 0) - (uses.get(idA) ?? 0) || (a < b ? -1 : 1));
  const todo = left.slice(0, limit);

  say(
    `${todo.length} icons to draw at ${tier}${todo.length < left.length ? `, the first of ${left.length} left` : ""} (${seeded.size} seeded foods, ${Object.keys(manifest.icons).length} drawn, ${borrowing} borrow, ${vague.size} vague groups).`
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

run(async () => {
  const tier = flag("--tier") ?? "low";
  // One at a time unless asked: a new account draws only a few images a minute.
  const concurrency = Number(flag("--concurrency") ?? 1);
  const limit = Number(flag("--limit") ?? Infinity);

  if (tier !== "low" && tier !== "medium") throw new Error(`Unknown tier: ${tier}`);
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error("--concurrency is a count");
  if (!(limit > 0)) throw new Error("--limit is a count");
  await full(tier, concurrency, limit, process.argv.includes("--yes"));
});
