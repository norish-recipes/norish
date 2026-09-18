/**
 * Ingredient picture E2E support: the direct database seams the spec uses to
 * start from no ingredients and read back what an administrator stored.
 */
import { Client } from "pg";

import { databaseUrl } from "./database";

async function withDatabase<T>(run: (database: Client) => Promise<T>): Promise<T> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    return await run(database);
  } finally {
    await database.end();
  }
}

/** Empty recipes, groceries and Ingredient Names, so every run starts from nothing. */
export async function resetIngredientPicturesScenario(): Promise<void> {
  await withDatabase(async (database) => {
    await database.query("delete from recipes");
    await database.query("delete from groceries");
    await database.query("delete from ingredients");
  });
}

/** The stored Ingredient Name: its picture and what uses it. */
export async function readIngredient(
  name: string
): Promise<{ imageUrl: string | null; recipeCount: number } | null> {
  return await withDatabase(async (database) => {
    const result = await database.query(
      `select i.image_url,
              (select count(distinct ri.recipe_id)::int from recipe_ingredients ri
                where ri.ingredient_id = i.id) as recipe_count
         from ingredients i where i.name = $1`,
      [name]
    );
    const row = result.rows[0] as { image_url: string | null; recipe_count: number } | undefined;

    return row ? { imageUrl: row.image_url, recipeCount: row.recipe_count } : null;
  });
}
