#!/usr/bin/env node
/**
 * Regenerate packages/shared-server/src/ai/prompts/retired-defaults.json:
 * for every administrator-editable prompt, every default text any release
 * shipped — including the current one — collected from the git history of
 * the shipped prompt files.
 *
 * The boot migration uses this to tell a database row still carrying a
 * seeded copy of an old default apart from a prompt an administrator wrote.
 * Run it after changing any prompt .txt (a shared-server test fails while
 * the file is stale):
 *
 *   node tooling/monorepo/scripts/generate-retired-prompt-defaults.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const promptsDir = "packages/shared-server/src/ai/prompts";
const outputPath = join(repoRoot, promptsDir, "retired-defaults.json");

/** Prompt file base names and the config field each is stored in. */
const PROMPT_FILES = {
  "recipe-extraction": "recipeExtraction",
  "image-extraction": "imageExtraction",
  "unit-conversion": "unitConversion",
  "nutrition-estimation": "nutritionEstimation",
  "auto-tagging": "autoTagging",
  "auto-categorization": "autoCategorization",
  "allergy-detection": "allergyDetection",
  "recipe-provenance": "recipeProvenance",
  "ingredient-linking": "ingredientLinking",
};

function git(...args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Matching in the migration is whitespace-insensitive; store one variant per normalized text. */
function normalize(text) {
  return text.replaceAll("\r\n", "\n").trim();
}

/**
 * Every (revision, path-at-that-revision) pair in the file's history,
 * newest first. --follow with --name-only reports the path the file had at
 * each revision — releases before 0.17 kept the prompts elsewhere.
 */
function fileHistory(path) {
  const log = git("log", "--follow", "--name-only", "--format=%x00%H", "--", path);

  return log
    .split("\0")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [hash, ...body] = block.split("\n");

      return { hash, path: body.filter(Boolean).at(-1) };
    })
    .filter((entry) => entry.path);
}

const retired = {};

for (const [file, field] of Object.entries(PROMPT_FILES)) {
  const path = `${promptsDir}/${file}.txt`;
  const seen = new Set();
  const variants = [];

  // The working tree's text is a shipped default the moment it releases;
  // leading with it keeps the file correct between edit and regeneration.
  const current = normalize(readFileSync(join(repoRoot, path), "utf-8"));

  if (current !== "") {
    seen.add(current);
    variants.push(current);
  }

  for (const revision of fileHistory(path)) {
    let content;

    try {
      content = git("show", `${revision.hash}:${revision.path}`);
    } catch {
      continue; // The revision deleted the file.
    }

    const normalized = normalize(content);

    if (normalized === "" || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    variants.push(normalized);
  }

  retired[field] = variants;
}

writeFileSync(outputPath, `${JSON.stringify(retired, null, 2)}\n`);

const counts = Object.entries(retired)
  .map(([field, variants]) => `${field}: ${variants.length}`)
  .join(", ");

console.log(`Wrote ${outputPath}`);
console.log(`Variants — ${counts}`);
