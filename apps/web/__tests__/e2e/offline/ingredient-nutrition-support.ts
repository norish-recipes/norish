import { Client } from "pg";

/**
 * Seeding for the Ingredient Nutrition browser spec. The stack applies the
 * committed source table at boot, but fetches no taxonomy (its catalogue URL
 * is blank), so the spec seeds the few Ingredients it reads as the seed
 * would have: an Open Food Facts id and the codes the taxonomy gives them.
 * A legacy mint ("salt to taste", flagged, as the resolver made it before
 * rung 2 stripped phrases) stands for an instance's history.
 */

export interface NutritionScenario {
  recipeId: string;
  ingredientIds: Record<
    "onion" | "redOnion" | "rice" | "milk" | "oliveOil" | "salt" | "flour",
    string
  >;
  legacyId: string;
}

interface Food {
  key: keyof NutritionScenario["ingredientIds"];
  name: string;
  offId: string | null;
  codes: Record<string, unknown> | null;
  parent?: keyof NutritionScenario["ingredientIds"];
}

const FOODS: Food[] = [
  {
    key: "onion",
    name: "onion",
    offId: "en:onion",
    codes: { ciqual: ["20034"], usda: [], ciqualOther: [], pieceWeight: 150, density: null },
  },
  // No codes of its own: it borrows the onion's numbers and piece weight.
  { key: "redOnion", name: "red onion", offId: "en:red-onion", codes: null, parent: "onion" },
  {
    key: "rice",
    name: "rice",
    offId: "en:rice",
    codes: { ciqual: ["9100"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
  // The taxonomy's code is skimmed milk; Norish's fix list makes it whole.
  {
    key: "milk",
    name: "milk",
    offId: "en:milk",
    codes: { ciqual: ["19051"], usda: [], ciqualOther: [], pieceWeight: null, density: 1.03 },
  },
  {
    key: "oliveOil",
    name: "olive oil",
    offId: "en:olive-oil",
    codes: { ciqual: ["17270"], usda: [], ciqualOther: [], pieceWeight: null, density: 0.92 },
  },
  {
    key: "salt",
    name: "salt",
    offId: "en:salt",
    codes: { ciqual: ["11058"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
  // Numbers from CIQUAL, which weighs no cups, and no density from anywhere.
  {
    key: "flour",
    name: "flour",
    offId: "en:wheat-flour",
    codes: { ciqual: ["9410"], usda: [], ciqualOther: [], pieceWeight: null, density: null },
  },
];

export const RECIPE_NAME = "Nutrition worked out";

/** The recipe's lines: [text, amount, unit, food]. */
const LINES: Array<
  [string, number | null, string | null, keyof NutritionScenario["ingredientIds"] | "legacy"]
> = [
  ["onion", 200, "gram", "onion"],
  ["rice", 300, "gram", "rice"],
  ["red onion", 3, null, "redOnion"],
  ["milk", 250, "milliliter", "milk"],
  ["flour", 1, "cup", "flour"],
  ["olive oil for frying", null, null, "oliveOil"],
  ["salt to taste", null, null, "legacy"],
];

async function connected<T>(databaseUrl: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** User A: the first user signed up, so the server's owner (the offline seed reads it alike). */
async function ownerId(client: Client): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `select id from "user" where "isServerOwner" = true order by "createdAt" limit 1`
  );

  if (!rows[0]) throw new Error("The offline owner is missing");

  return rows[0].id;
}

/** Seed the Ingredients, the legacy mint and user A's recipe, and answer their ids. */
export async function seedNutritionScenario(databaseUrl: string): Promise<NutritionScenario> {
  return await connected(databaseUrl, async (client) => {
    const owner = await ownerId(client);
    const ingredientIds = {} as NutritionScenario["ingredientIds"];
    const aliasIds = {} as Record<string, string>;

    for (const food of FOODS) {
      const { rows } = await client.query<{ id: string }>(
        `insert into ingredients (name, off_id, nutrition_codes, parent_id)
         values ($1, $2, $3::jsonb, $4) returning id`,
        [
          food.name,
          food.offId,
          food.codes ? JSON.stringify(food.codes) : null,
          food.parent ? ingredientIds[food.parent] : null,
        ]
      );

      ingredientIds[food.key] = rows[0]!.id;

      const alias = await client.query<{ id: string }>(
        `insert into ingredient_aliases (text, fold, locale, ingredient_id, seeded)
         values ($1, $1, 'en', $2, true) returning id`,
        [food.name, rows[0]!.id]
      );

      aliasIds[food.key] = alias.rows[0]!.id;
    }

    const legacy = await client.query<{ id: string }>(
      `insert into ingredients (name, owner_id, flagged, flag_reason)
       values ('salt to taste', $1, true, 'upgrade') returning id`,
      [owner]
    );
    const legacyAlias = await client.query<{ id: string }>(
      `insert into ingredient_aliases (text, fold, ingredient_id, owner_id)
       values ('salt to taste', 'salt to taste', $1, $2) returning id`,
      [legacy.rows[0]!.id, owner]
    );

    aliasIds.legacy = legacyAlias.rows[0]!.id;

    const recipe = await client.query<{ id: string }>(
      `insert into recipes (user_id, name, servings) values ($1, $2, 2) returning id`,
      [owner, RECIPE_NAME]
    );
    const recipeId = recipe.rows[0]!.id;

    for (const [index, [text, amount, unit, food]] of LINES.entries()) {
      await client.query(
        `insert into recipe_ingredients (recipe_id, name, ingredient_alias_id, amount, unit, "order", system_used)
         values ($1, $2, $3, $4, $5, $6, 'metric')`,
        [recipeId, text, aliasIds[food], amount, unit, index]
      );
    }

    return { recipeId, ingredientIds, legacyId: legacy.rows[0]!.id };
  });
}

/** Have the next boot look at old flagged mints again, as an upgrade to new rules would. */
export async function forgetRungVersion(databaseUrl: string): Promise<void> {
  await connected(databaseUrl, async (client) => {
    await client.query(
      `update server_config set value = jsonb_set(value, '{rungVersion}', '0'::jsonb)
       where key = 'ingredient_seed_state'`
    );
  });
}

/** Which Ingredient a recipe line's alias points at now. */
export async function lineIngredient(
  databaseUrl: string,
  recipeId: string,
  text: string
): Promise<string | null> {
  return await connected(databaseUrl, async (client) => {
    const { rows } = await client.query<{ ingredient_id: string }>(
      `select a.ingredient_id from recipe_ingredients r
       join ingredient_aliases a on a.id = r.ingredient_alias_id
       where r.recipe_id = $1 and r.name = $2`,
      [recipeId, text]
    );

    return rows[0]?.ingredient_id ?? null;
  });
}

/** Take the scenario away again, so the offline suite after it finds what it seeded. */
export async function removeNutritionScenario(
  databaseUrl: string,
  scenario: NutritionScenario | null
): Promise<void> {
  if (!scenario) return;

  await connected(databaseUrl, async (client) => {
    await client.query(`delete from recipes where id = $1`, [scenario.recipeId]);
    await client.query(`delete from ingredients where id = any($1::uuid[])`, [
      [...Object.values(scenario.ingredientIds), scenario.legacyId],
    ]);
  });
}
