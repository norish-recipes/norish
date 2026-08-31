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

/** The instance owner, whose session the browser fixture carries. */
async function ownerId(database: Client): Promise<string> {
  const result = await database.query<{ id: string }>(
    `select id from "user" where "isServerOwner" = true order by "createdAt" limit 1`
  );
  const owner = result.rows[0];

  if (!owner) throw new Error("The AI fixture owner is missing");

  return owner.id;
}

/** Seed a recipe directly, so the spec spends its time on cookbooks. */
export function seedRecipe(name: string): Promise<string> {
  return withDatabase(async (database) => {
    const owner = await ownerId(database);
    const result = await database.query<{ id: string }>(
      `insert into recipes (user_id, name, description, servings)
       values ($1, $2, 'Seeded for the cookbooks browser scenario.', 4)
       returning id`,
      [owner, name]
    );

    return result.rows[0]!.id;
  });
}

/** Which recipes a cookbook holds, by title. */
export function readCookbookMembers(title: string): Promise<string[]> {
  return withDatabase(async (database) => {
    const result = await database.query<{ name: string }>(
      `select r.name
         from cookbooks c
         join cookbook_recipes m on m.cookbook_id = c.id
         join recipes r on r.id = m.recipe_id
        where c.title = $1
        order by r.name`,
      [title]
    );

    return result.rows.map((row) => row.name);
  });
}

/** Every stored cookbook title. */
export function readCookbookTitles(): Promise<string[]> {
  return withDatabase(async (database) => {
    const result = await database.query<{ title: string }>(
      `select title from cookbooks order by title`
    );

    return result.rows.map((row) => row.title);
  });
}

/** Whether a recipe row still exists, by name. */
export function recipeExists(name: string): Promise<boolean> {
  return withDatabase(async (database) => {
    const result = await database.query(`select 1 from recipes where name = $1`, [name]);

    return result.rowCount !== null && result.rowCount > 0;
  });
}

/** Drop one cookbook, so a scenario that made its own can clean up after it. */
export function deleteCookbookByTitle(title: string): Promise<void> {
  return withDatabase(async (database) => {
    await database.query(`delete from cookbooks where title = $1`, [title]);
  });
}

/** Clear every cookbook, so each scenario starts from a known Library. */
export function clearCookbooks(): Promise<void> {
  return withDatabase(async (database) => {
    await database.query(`delete from cookbooks`);
  });
}
