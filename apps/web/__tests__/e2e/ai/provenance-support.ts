import { Client } from "pg";

import { databaseUrl } from "./database";

export async function findCuisineIdByName(name: string): Promise<string> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const result = await database.query<{ id: string }>(
      "select id from cuisines where lower(name) = lower($1)",
      [name]
    );
    const id = result.rows[0]?.id;

    if (!id) throw new Error(`Seeded Cuisine missing: ${name}`);

    return id;
  } finally {
    await database.end();
  }
}

export async function readStoredProvenance(recipeName: string): Promise<{
  originCountry: string | null;
  originCountryName: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
  cuisines: string[];
}> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const recipe = await database.query<{
      id: string;
      origin_country: string | null;
      origin_country_name: string | null;
      origin_region: string | null;
      provenance_note: string | null;
    }>(
      "select id, origin_country, origin_country_name, origin_region, provenance_note from recipes where name = $1",
      [recipeName]
    );
    const row = recipe.rows[0];

    if (!row) throw new Error(`Recipe not found: ${recipeName}`);

    const cuisines = await database.query<{ name: string }>(
      `select c.name from recipe_cuisines rc
         join cuisines c on c.id = rc.cuisine_id
        where rc.recipe_id = $1
        order by rc."order"`,
      [row.id]
    );

    return {
      originCountry: row.origin_country,
      originCountryName: row.origin_country_name,
      originRegion: row.origin_region,
      provenanceNote: row.provenance_note,
      cuisines: cuisines.rows.map((cuisine) => cuisine.name),
    };
  } finally {
    await database.end();
  }
}

export async function supplyProvenance(
  recipeName: string,
  provenance: { originCountry?: string; provenanceNote?: string; cuisineIds?: string[] }
): Promise<void> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const recipe = await database.query<{ id: string }>("select id from recipes where name = $1", [
      recipeName,
    ]);
    const id = recipe.rows[0]?.id;

    if (!id) throw new Error(`Recipe not found: ${recipeName}`);

    await database.query(
      `update recipes set origin_country = $2, provenance_note = $3, version = version + 1
        where id = $1`,
      [id, provenance.originCountry ?? null, provenance.provenanceNote ?? null]
    );

    for (const [order, cuisineId] of (provenance.cuisineIds ?? []).entries()) {
      await database.query(
        `insert into recipe_cuisines (recipe_id, cuisine_id, "order") values ($1, $2, $3)
         on conflict do nothing`,
        [id, cuisineId, order]
      );
    }
  } finally {
    await database.end();
  }
}
