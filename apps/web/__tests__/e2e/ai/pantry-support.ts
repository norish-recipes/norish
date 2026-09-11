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

/**
 * The state this scenario reads: its recipes, its groceries and the Ingredient
 * Names they point at. Run before seeding, so the scenario answers for what it
 * put there and not for whatever spec ran before it.
 */
export function resetPantryScenario(): Promise<void> {
  return withDatabase(async (database) => {
    await database.query("delete from recipes");
    await database.query("delete from groceries");
    await database.query("delete from ingredients");
  });
}

/**
 * A recipe with the given ingredient lines, seeded straight in the database so
 * the scenario spends its time on the Pantry rather than on an import. Each
 * line is an amount-less ingredient by name; nothing outbound is involved.
 */
export function seedRecipeWithIngredients(name: string, lines: string[]): Promise<string> {
  return withDatabase(async (database) => {
    const owner = (
      await database.query<{ id: string }>(`select id from "user" order by "createdAt" asc limit 1`)
    ).rows[0];

    if (!owner) throw new Error("The harness has provisioned no accounts");
    const recipe = await database.query<{ id: string }>(
      `insert into recipes (user_id, name, description, servings)
       values ($1, $2, 'Seeded for the pantry browser scenario.', 2)
       returning id`,
      [owner.id, name]
    );
    const recipeId = recipe.rows[0]!.id;

    for (const [index, line] of lines.entries()) {
      const ingredient = await database.query<{ id: string }>(
        `insert into ingredients (name) values ($1)
         on conflict (lower(name)) do update set name = excluded.name
         returning id`,
        [line]
      );

      await database.query(
        `insert into recipe_ingredients (recipe_id, ingredient_id, amount, unit, "order", system_used)
         values ($1, $2, null, null, $3, 'metric')`,
        [recipeId, ingredient.rows[0]!.id, index]
      );
    }

    return recipeId;
  });
}

/**
 * The Pantry as the database has it: every folded name, in order. A Pantry
 * Item holds no name of its own, so this reads the Ingredient Name it points
 * at, the same join the repository makes.
 */
export function readPantryNames(): Promise<string[]> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ normalized_name: string }>(
      `select i.normalized_name from pantry_ingredients p
         join ingredients i on i.id = p.ingredient_id
        order by i.normalized_name asc`
    );

    return rows.rows.map((row) => row.normalized_name);
  });
}

/** The grocery names on the list, as the database has them. */
export function readGroceryNames(): Promise<string[]> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ name: string }>(`select name from groceries order by name`);

    return rows.rows.map((row) => row.name);
  });
}
