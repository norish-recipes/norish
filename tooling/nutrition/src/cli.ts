/**
 * Rebuild Ingredient Nutrition's source table from the public downloads
 * (ADR-0039) and write it where the server reads it, when it changed:
 *
 *   pnpm --filter @norish/nutrition-sources build:table [--downloads <dir>]
 *
 * `--downloads` keeps the fetched files in a directory, and reuses them on a
 * second run instead of fetching again. Any failure exits non-zero and leaves
 * the committed table as it was.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  serializeSourceTable,
  SOURCE_TABLE_PATH,
  SourceTableSchema,
} from "@norish/shared-server/ingredients/nutrition/source-table";
import { resolveWorkspaceRootPath } from "@norish/shared-server/lib/workspace-paths";

import type { Download } from "./sources";
import { buildSourceTable } from "./build";
import { downloadAll, locateDownloads } from "./download";
import { DENSITY_FIXES, FIX_LIST, NEVER_LEND, PIECE_FIXES } from "./lists";
import { DOWNLOADS, readSources } from "./sources";

/** A line of what the build did, for the person or the workflow running it. */
function say(...parts: unknown[]): void {
  process.stdout.write(
    `${parts.map((part) => (typeof part === "string" ? part : JSON.stringify(part, null, 2))).join(" ")}\n`
  );
}

/** The committed table's version, whatever else it holds: it is about to be replaced. */
function previousVersion(text: string): string | null {
  try {
    const { version } = JSON.parse(text) as { version?: unknown };

    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf("--downloads");
  const dir =
    flag >= 0 ? process.argv[flag + 1]! : await mkdtemp(join(tmpdir(), "norish-nutrition-"));
  const editionsFile = join(dir, "editions.json");
  const cached = (Object.keys(DOWNLOADS) as Download[]).every((download) =>
    existsSync(join(dir, DOWNLOADS[download]))
  );
  let editions;

  if (cached && existsSync(editionsFile)) {
    say(`Reusing the downloads in ${dir}`);
    editions = JSON.parse(await readFile(editionsFile, "utf8"));
  } else {
    const located = await locateDownloads();

    say("Downloading", located.urls);
    await downloadAll(dir, located);
    await writeFile(editionsFile, JSON.stringify(located.editions, null, 2));
    editions = located.editions;
  }

  const table = buildSourceTable(
    await readSources(dir),
    {
      fixes: FIX_LIST,
      densityFixes: DENSITY_FIXES,
      pieceFixes: PIECE_FIXES,
      neverLend: NEVER_LEND,
    },
    editions
  );
  const path = resolveWorkspaceRootPath(SOURCE_TABLE_PATH);
  const previous = existsSync(path) ? previousVersion(await readFile(path, "utf8")) : null;

  say(
    `Built table ${table.version}: ${table.foods.length} foods, ${Object.keys(table.names).length} name matches, ${Object.keys(table.fixes).length} fixes, ${Object.keys(table.densityFixes).length} density fixes, ${Object.keys(table.pieceFixes).length} piece fixes`
  );
  if (previous === table.version) {
    say("The table is unchanged");

    return;
  }
  // What is written must read back as a table, or no instance could apply it.
  SourceTableSchema.parse(JSON.parse(serializeSourceTable(table)));
  await writeFile(path, serializeSourceTable(table));
  say(`Wrote ${path}`);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
