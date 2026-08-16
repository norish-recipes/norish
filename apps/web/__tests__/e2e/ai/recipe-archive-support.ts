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

export interface StoredRecipe {
  id: string;
  userId: string | null;
  /** Gallery image web paths, hero image first when the recipe has one */
  images: string[];
}

/**
 * Every stored recipe carrying this name. More than one row is a duplicate —
 * exactly what overwrite-on-match promises not to produce.
 */
export function readStoredRecipes(name: string): Promise<StoredRecipe[]> {
  return withDatabase(async (database) => {
    const result = await database.query<{
      id: string;
      user_id: string | null;
      hero: string | null;
      gallery: string[];
    }>(
      `select r.id,
              r.user_id,
              r.image as hero,
              coalesce(
                array_agg(i.image order by i."order") filter (where i.image is not null),
                '{}'
              ) as gallery
         from recipes r
         left join recipe_images i on i.recipe_id = r.id
        where r.name = $1
        group by r.id`,
      [name]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      images: [...(row.hero ? [row.hero] : []), ...row.gallery],
    }));
  });
}

export interface RecipeMarks {
  rating: number | null;
  favorite: boolean;
}

export function readMarks(userId: string, recipeId: string): Promise<RecipeMarks> {
  return withDatabase(async (database) => {
    const rating = await database.query<{ rating: number }>(
      "select rating from recipe_ratings where user_id = $1 and recipe_id = $2",
      [userId, recipeId]
    );
    const favorite = await database.query(
      "select 1 from recipe_favorites where user_id = $1 and recipe_id = $2",
      [userId, recipeId]
    );

    return {
      rating: rating.rows[0]?.rating ?? null,
      favorite: favorite.rowCount === 1,
    };
  });
}

/** Mark a recipe as the exporting user, so the marks have something to travel with. */
export function applyMarks(userId: string, recipeId: string, rating: number): Promise<void> {
  return withDatabase(async (database) => {
    await database.query(
      `insert into recipe_ratings (user_id, recipe_id, rating) values ($1, $2, $3)
       on conflict (user_id, recipe_id) do update set rating = excluded.rating`,
      [userId, recipeId, rating]
    );
    await database.query(
      `insert into recipe_favorites (user_id, recipe_id) values ($1, $2)
       on conflict (user_id, recipe_id) do nothing`,
      [userId, recipeId]
    );
  });
}

/** Wipe the marks between export and reimport, so restoring them proves the import applied them. */
export function clearMarks(userId: string, recipeId: string): Promise<void> {
  return withDatabase(async (database) => {
    await database.query("delete from recipe_ratings where user_id = $1 and recipe_id = $2", [
      userId,
      recipeId,
    ]);
    await database.query("delete from recipe_favorites where user_id = $1 and recipe_id = $2", [
      userId,
      recipeId,
    ]);
  });
}
