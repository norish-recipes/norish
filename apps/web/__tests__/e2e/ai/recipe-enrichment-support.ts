import { request } from "@playwright/test";
import { Client } from "pg";

import type { SessionCookies } from "./fixture";
import { databaseUrl } from "./database";

export async function setAutomaticEnrichment(
  switches: Partial<
    Record<
      | "autoTagging"
      | "allergyDetection"
      | "autoCategorization"
      | "nutritionEstimation"
      | "recipeProvenance",
      boolean
    >
  >
): Promise<void> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    await database.query(
      `update server_config
         set value = jsonb_set(value, '{automaticEnrichment}', $1::jsonb, true)
       where key = 'ai_config'`,
      [
        JSON.stringify({
          autoTagging: false,
          allergyDetection: false,
          autoCategorization: false,
          nutritionEstimation: false,
          recipeProvenance: false,
          ...switches,
        }),
      ]
    );
  } finally {
    await database.end();
  }
}

export async function readStoredCategories(recipeName: string): Promise<string[]> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const recipe = await database.query<{ categories: string[] }>(
      "select array_to_json(categories) as categories from recipes where name = $1",
      [recipeName]
    );
    const row = recipe.rows[0];

    if (!row) throw new Error(`Recipe not found: ${recipeName}`);

    return row.categories;
  } finally {
    await database.end();
  }
}

export async function supplyUserAllergies(
  baseURL: string,
  cookies: SessionCookies,
  allergies: string[]
): Promise<void> {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      origin: baseURL,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const current = await api.get("/api/trpc/user.getAllergies");

    if (!current.ok()) throw new Error(`getAllergies failed: ${current.status()}`);

    const body = (await current.json()) as {
      result: { data: { json: { version: number } } };
    };
    const response = await api.post("/api/trpc/user.setAllergies", {
      data: { json: { allergies, version: body.result.data.json.version } },
    });

    if (!response.ok()) throw new Error(`setAllergies failed: ${response.status()}`);
  } finally {
    await api.dispose();
  }
}
