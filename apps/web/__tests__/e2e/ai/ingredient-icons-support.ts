/**
 * Ingredient Icons E2E support: the pictures the scenario uploads and the
 * fake image provider draws, and the database seams it seeds a grocery with
 * and reads a food's own icon back through.
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

import { withDatabase } from "./database";

/**
 * A product shot as a person would upload one: a single coloured food on a
 * flat white ground, which the cut-out frees from its background.
 */
export async function pictureOfFood(colour: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="#ffffff"/>
    <circle cx="128" cy="128" r="80" fill="${colour}"/>
  </svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/** The picture written to a file, for a file input to take. */
export async function pictureFile(colour: string): Promise<string> {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "norish-icon-")), "food.png");

  writeFileSync(file, await pictureOfFood(colour));

  return file;
}

/** A food's own icon as the database has it: the stored file's name, or null. */
export function readOwnIcon(name: string): Promise<string | null> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ icon: string | null }>(
      `select icon from ingredients where lower(name) = lower($1)`,
      [name]
    );

    return rows.rows[0]?.icon ?? null;
  });
}

/** A grocery on the first account's list, for a food the catalogue knows by that spelling. */
export function seedGrocery(name: string): Promise<void> {
  return withDatabase(async (database) => {
    const owner = (
      await database.query<{ id: string }>(`select id from "user" order by "createdAt" asc limit 1`)
    ).rows[0];

    if (!owner) throw new Error("The harness has provisioned no accounts");
    await database.query(
      `insert into groceries (user_id, name, ingredient_alias_id, ingredient_id)
       select $1, $2, a.id, a.ingredient_id from ingredient_aliases a where a.fold = lower($2)`,
      [owner.id, name]
    );
  });
}
