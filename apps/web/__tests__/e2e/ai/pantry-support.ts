import { withDatabase } from "./database";

/**
 * The state this scenario reads: its recipes, its groceries and the Ingredient
 * Names they point at. Run before seeding, so the scenario answers for what it
 * put there and not for whatever spec ran before it.
 */
export function resetPantryScenario(): Promise<void> {
  return withDatabase(async (database) => {
    await database.query("delete from recipes");
    await database.query("delete from groceries");
    await database.query("delete from recurring_groceries");
    await database.query("delete from ingredients");
  });
}

/**
 * A Store the household sends a food to: the store preference a grocery
 * added without a Store is filed by. Answers with the Store's id.
 */
export function seedStorePreference(storeName: string, ingredientName: string): Promise<string> {
  return withDatabase(async (database) => {
    const owner = (
      await database.query<{ id: string }>(`select id from "user" order by "createdAt" asc limit 1`)
    ).rows[0];

    if (!owner) throw new Error("The harness has provisioned no accounts");
    await database.query(`delete from stores where name = $1`, [storeName]);
    const store = await database.query<{ id: string }>(
      `insert into stores (user_id, name) values ($1, $2) returning id`,
      [owner.id, storeName]
    );

    await database.query(
      `insert into ingredient_store_preferences (user_id, ingredient_id, store_id)
       select $1, id, $3 from ingredients where lower(name) = lower($2)`,
      [owner.id, ingredientName, store.rows[0]!.id]
    );

    return store.rows[0]!.id;
  });
}

/** The groceries as the database has them: each one's name, Store and tick. */
export function readGroceries(): Promise<
  Array<{ name: string; storeId: string | null; isDone: boolean }>
> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ name: string; store_id: string | null; is_done: boolean }>(
      `select name, store_id, is_done from groceries order by name`
    );

    return rows.rows.map((row) => ({ name: row.name, storeId: row.store_id, isDone: row.is_done }));
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
      const ingredientId = ingredient.rows[0]!.id;
      // The line's spelling as an Ingredient Alias. The scenario's names are
      // plain lowercase words, so their fold is their lowercase self.
      const alias = await database.query<{ id: string }>(
        `insert into ingredient_aliases (text, fold, ingredient_id) values ($1, lower($1), $2)
         on conflict (fold) do update set text = ingredient_aliases.text
         returning id`,
        [line, ingredientId]
      );

      await database.query(
        `insert into recipe_ingredients
           (recipe_id, name, ingredient_alias_id, amount, unit, "order", system_used)
         values ($1, $2, $3, null, null, $4, 'metric')`,
        [recipeId, line, alias.rows[0]!.id, index]
      );
    }

    return recipeId;
  });
}

/**
 * The Pantry as the database has it: every name, lowercase, in order. A
 * Pantry Ingredient holds no name of its own, so this reads the Ingredient it
 * points at, the same join the repository makes.
 */
export function readPantryNames(): Promise<string[]> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ name: string }>(
      `select lower(i.name) as name from pantry_ingredients p
         join ingredients i on i.id = p.ingredient_id
        order by lower(i.name) asc`
    );

    return rows.rows.map((row) => row.name);
  });
}

/** The grocery names on the list, as the database has them. */
export function readGroceryNames(): Promise<string[]> {
  return withDatabase(async (database) => {
    const rows = await database.query<{ name: string }>(`select name from groceries order by name`);

    return rows.rows.map((row) => row.name);
  });
}
