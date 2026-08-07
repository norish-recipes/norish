import { Client } from "pg";

import { databaseUrl } from "./database";

export async function readStoredStepIngredients(recipeName: string): Promise<
  {
    systemUsed: string;
    stepOrder: number;
    ingredientOrder: number;
    share: number;
  }[]
> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const rows = await database.query<{
      system_used: string;
      step_order: string;
      ingredient_order: string;
      share: string;
    }>(
      `select s.system_used, s."order" as step_order, ri."order" as ingredient_order, si.share
         from step_ingredients si
         join steps s on s.id = si.step_id
         join recipe_ingredients ri on ri.id = si.recipe_ingredient_id
         join recipes r on r.id = s.recipe_id
        where r.name = $1
        order by s.system_used, s."order", si."order"`,
      [recipeName]
    );

    return rows.rows.map((row) => ({
      systemUsed: row.system_used,
      stepOrder: Number(row.step_order),
      ingredientOrder: Number(row.ingredient_order),
      share: Number(row.share),
    }));
  } finally {
    await database.end();
  }
}

export async function supplyStepIngredient(
  recipeName: string,
  link: { systemUsed: string; stepOrder: number; ingredientOrder: number; share: number }
): Promise<void> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const inserted = await database.query(
      `insert into step_ingredients (step_id, recipe_ingredient_id, share, "order")
       select s.id, ri.id, $4, 0
         from recipes r
         join steps s on s.recipe_id = r.id and s.system_used = $2 and s."order" = $3::numeric
         join recipe_ingredients ri
           on ri.recipe_id = r.id and ri.system_used = $2 and ri."order" = $5::numeric
        where r.name = $1
        returning id`,
      [recipeName, link.systemUsed, link.stepOrder, String(link.share), link.ingredientOrder]
    );

    if (inserted.rowCount !== 1) {
      throw new Error(`Could not attach Step Ingredient on: ${recipeName}`);
    }
  } finally {
    await database.end();
  }
}
