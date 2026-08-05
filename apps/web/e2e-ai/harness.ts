/**
 * Reusable building blocks for production-like AI browser scenarios.
 *
 * A scenario boots the stack once (`bootStack`), signs users in against the
 * real auth API (`signIn`), and drives the deterministic provider through
 * `stack.ai.control`. This keeps every `.e2e.ts` free of harness
 * plumbing and free of scenario-specific coupling to the offline suite.
 */
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, request } from "@playwright/test";
import { Client } from "pg";

import type { FakeAIProvider } from "./ai-provider";
import type { E2eServer } from "./server";
import { createFakeAIProvider } from "./ai-provider";
import { E2E_BASE_URL, E2E_DATABASE_URL, FAKE_AI_PORT } from "./env";
import { startServer } from "./server";

export { createFakeAIProvider } from "./ai-provider";
export type { AIProviderControl, Directive, FakeAIProvider } from "./ai-provider";
export { startServer } from "./server";
export type { E2eServer } from "./server";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

/**
 * Drive the paste-import dialog through to a submitted import.
 *
 * Retried as a unit: a leftover toast can steal the click that opens the
 * menu, and the dialog itself can close between the fill and the submit —
 * connection-recovery re-renders have been caught unmounting it mid-flow.
 * Every attempt after the first starts from a reload, because a dialog can
 * also survive with its AI Import action missing (the permissions read died
 * on a connection drop), and only a fresh page heals a dead query. The
 * submit click carries a short timeout so a dead control fails the attempt
 * instead of hanging the test, and a click only throws before it
 * dispatches, so a retry can never submit the same import twice.
 */
export async function submitPasteImport(page: Page, text: string): Promise<void> {
  const pasteArea = page.getByPlaceholder("Paste a recipe (free text) or JSON-LD here...");
  let attempt = 0;

  await expect(async () => {
    if (attempt++ > 0) {
      await page.reload();
    }

    if (!(await pasteArea.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
      await page.getByRole("menuitem", { name: "Paste" }).click({ timeout: 2_000 });
      await expect(pasteArea).toBeVisible({ timeout: 2_000 });
    }

    await pasteArea.fill(text);
    await page.getByRole("button", { name: "AI Import" }).click({ timeout: 3_000 });
  }).toPass({ timeout: 90_000, intervals: [500, 1_000, 2_000] });
}

/** A 1x1 transparent PNG — valid image bytes without a fixture file. */
export const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Drive the image-import dialog through to a submitted import.
 */
export async function submitImageImport(page: Page): Promise<void> {
  let attempt = 0;

  await expect(async () => {
    if (attempt++ > 0) {
      await page.reload();
    }

    const fileInput = page.locator("input[type='file']");

    if (!(await fileInput.isVisible().catch(() => false))) {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
      await page.getByRole("menuitem", { name: "Image" }).click({ timeout: 2_000 });
    }

    await fileInput.setInputFiles({
      name: "cookbook-page.png",
      mimeType: "image/png",
      buffer: ONE_PIXEL_PNG,
    });
    await page.getByRole("button", { name: "Import with AI" }).click({ timeout: 3_000 });
  }).toPass({ timeout: 90_000, intervals: [500, 1_000, 2_000] });
}

/**
 * Open the Prompts panel of the admin tab and return a locator scoped to it:
 * the admin tab renders several forms with their own Save buttons, so every
 * prompt selector must live inside the panel.
 */
export async function openPromptsPanel(page: Page) {
  await page.goto("/settings?tab=admin");

  const trigger = page.getByRole("button", { name: /^Prompts/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();

  const panelId = await trigger.getAttribute("aria-controls");

  return page.locator(`[id="${panelId}"]`);
}

/**
 * Edit prompts through the real administrator surface: the Prompts panel of
 * the AI & Processing card. Saving waits for the form to settle back into its
 * clean state, so a following import runs against the stored prompt.
 */
export async function editPrompts(page: Page, edits: Record<string, string>): Promise<void> {
  const panel = await openPromptsPanel(page);

  for (const [label, text] of Object.entries(edits)) {
    const field = panel.getByRole("textbox", { name: label });

    await field.scrollIntoViewIfNeeded();
    await field.fill(text);
  }

  const save = panel.getByRole("button", { name: "Save", exact: true });

  await save.click();
  // The save round-trips through the admin API and the refreshed prompts make
  // the form clean again; a disabled Save is the observable end of that.
  await expect(save).toBeDisabled({ timeout: 15_000 });
}

/** Sign in against the real auth API and return the resulting session cookies. */
export async function signIn(user: { email: string; password: string }): Promise<SessionCookies> {
  const api = await request.newContext({
    baseURL: E2E_BASE_URL,
    // Better Auth rejects auth POSTs without a trusted Origin.
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });

  try {
    const response = await api.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });

    if (!response.ok()) {
      throw new Error(`sign-in for ${user.email} failed: ${response.status()}`);
    }

    const state = await api.storageState();

    return state.cookies;
  } finally {
    await api.dispose();
  }
}

/**
 * Set the Automatic Recipe Enrichment switches in the harness database.
 *
 * They are written straight into `ai_config` because the administrator UI is
 * not the subject under test. Server config is read from the database on every
 * call, so no restart and no cache flush is needed — and flushing Redis here
 * would drop the signed-in session.
 *
 * Every switch not named is turned off, so a scenario states exactly which
 * kinds may enrol and cannot inherit another scenario's settings.
 */
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
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    await db.query(
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
    await db.end();
  }
}

/** A Cuisine from the seeded vocabulary, by name. */
export async function findCuisineIdByName(name: string): Promise<string> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    const result = await db.query<{ id: string }>(
      "select id from cuisines where lower(name) = lower($1)",
      [name]
    );
    const id = result.rows[0]?.id;

    if (!id) throw new Error(`Seeded Cuisine missing: ${name}`);

    return id;
  } finally {
    await db.end();
  }
}

/**
 * Give the signed-in user configured allergies, through their own settings
 * API — user rows keep encrypted columns, so the database is not a shortcut
 * here. Allergy detection only issues an AI request when the household has at
 * least one allergen configured.
 */
export async function supplyUserAllergies(
  cookies: SessionCookies,
  allergies: string[]
): Promise<void> {
  const api = await request.newContext({
    baseURL: E2E_BASE_URL,
    extraHTTPHeaders: {
      origin: E2E_BASE_URL,
      cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });

  try {
    const current = await api.get("/api/trpc/user.getAllergies");

    if (!current.ok()) {
      throw new Error(`getAllergies failed: ${current.status()}`);
    }

    const body = (await current.json()) as {
      result: { data: { json: { version: number } } };
    };

    const response = await api.post("/api/trpc/user.setAllergies", {
      data: { json: { allergies, version: body.result.data.json.version } },
    });

    if (!response.ok()) {
      throw new Error(`setAllergies failed: ${response.status()}`);
    }
  } finally {
    await api.dispose();
  }
}

/** Read a recipe's stored Recipe Provenance straight from the database. */
export async function readStoredProvenance(recipeName: string): Promise<{
  originCountry: string | null;
  originCountryName: string | null;
  originRegion: string | null;
  provenanceNote: string | null;
  cuisines: string[];
}> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    const recipe = await db.query<{
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

    const cuisines = await db.query<{ name: string }>(
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
    await db.end();
  }
}

/** Read a recipe's stored categories straight from the database. */
export async function readStoredCategories(recipeName: string): Promise<string[]> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    // categories is an array of a custom enum type, which node-postgres does
    // not parse; array_to_json turns it into something it does.
    const recipe = await db.query<{ categories: string[] }>(
      "select array_to_json(categories) as categories from recipes where name = $1",
      [recipeName]
    );
    const row = recipe.rows[0];

    if (!row) throw new Error(`Recipe not found: ${recipeName}`);

    return row.categories;
  } finally {
    await db.end();
  }
}

/** Write Recipe Provenance straight into the database, as a person would have. */
export async function supplyProvenance(
  recipeName: string,
  provenance: { originCountry?: string; provenanceNote?: string; cuisineIds?: string[] }
): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    const recipe = await db.query<{ id: string }>("select id from recipes where name = $1", [
      recipeName,
    ]);
    const id = recipe.rows[0]?.id;

    if (!id) throw new Error(`Recipe not found: ${recipeName}`);

    await db.query(
      `update recipes set origin_country = $2, provenance_note = $3, version = version + 1
        where id = $1`,
      [id, provenance.originCountry ?? null, provenance.provenanceNote ?? null]
    );

    for (const [order, cuisineId] of (provenance.cuisineIds ?? []).entries()) {
      await db.query(
        `insert into recipe_cuisines (recipe_id, cuisine_id, "order") values ($1, $2, $3)
         on conflict do nothing`,
        [id, cuisineId, order]
      );
    }
  } finally {
    await db.end();
  }
}

/** Read a recipe's stored Step Ingredients straight from the database. */
export async function readStoredStepIngredients(recipeName: string): Promise<
  {
    systemUsed: string;
    stepOrder: number;
    ingredientOrder: number;
    share: number;
  }[]
> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    const rows = await db.query<{
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
    await db.end();
  }
}

/**
 * Attach a Step Ingredient straight into the database, as an editor's chip
 * would have. Writes one system's step only — exactly what the editor does.
 */
export async function supplyStepIngredient(
  recipeName: string,
  link: { systemUsed: string; stepOrder: number; ingredientOrder: number; share: number }
): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    const inserted = await db.query(
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
    await db.end();
  }
}

export interface AIE2EStack {
  ai: FakeAIProvider;
  server: E2eServer;
  stop(): Promise<void>;
}

/**
 * Start the deterministic AI provider and the production server, in that order
 * so the server can reach the provider the moment a job runs. Returns a single
 * `stop` that tears both down (server first, so no in-flight job outlives it).
 */
export async function bootStack(): Promise<AIE2EStack> {
  const ai = createFakeAIProvider({ port: FAKE_AI_PORT });

  await ai.start();

  let server: E2eServer;

  try {
    server = await startServer();
  } catch (error) {
    await ai.stop().catch(() => undefined);
    throw error;
  }

  return {
    ai,
    server,
    async stop() {
      await server.stop().catch(() => undefined);
      await ai.stop().catch(() => undefined);
    },
  };
}
