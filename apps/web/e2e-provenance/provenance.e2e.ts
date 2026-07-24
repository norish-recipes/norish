/**
 * Recipe Provenance tracer-bullet acceptance scenario (issue 02).
 *
 * Begins with a structured paste import and proves the full vertical slice with
 * only the AI-provider HTTP boundary replaced: the import stays responsive, a
 * real provenance job is queued, recipe detail shows a provenance-only pending
 * state, the controlled inference is persisted, the panel refreshes over the
 * real recipe realtime channel without a manual reload, the final provenance
 * renders, and a known country flag prefixes the unchanged recipe title.
 *
 * The recipe itself comes from the pasted JSON-LD, so the origin country/flag
 * can only have come from the controlled provider response.
 */
import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import type { ProvenanceStack } from "./harness";
import { PROV_BASE_URL, USER_A } from "./env";
import { bootStack, signIn } from "./harness";

test.describe.configure({ mode: "serial" });

const RECIPE_NAME = "Provenance Tracer Lasagne";

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: RECIPE_NAME,
  recipeIngredient: ["500 g pasta sheets", "400 g minced beef", "200 g mozzarella"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Layer the pasta, beef, and cheese in a dish." },
    { "@type": "HowToStep", text: "Bake for 40 minutes until golden." },
  ],
  recipeYield: "4",
});

// The one controlled inference result. A known country (IT) drives the flag.
const PROVENANCE = {
  originCountryCode: "IT",
  region: "Emilia-Romagna",
  cuisines: ["Italian"],
  note: "A baked pasta traditionally associated with the Emilia-Romagna region.",
};

let stack: ProvenanceStack | null = null;
let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: PROV_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

test("paste import to rendered, country-prefixed provenance", async () => {
  const ai = stack!.ai;

  ai.control.reset();
  ai.control.succeedWith(PROVENANCE);
  // Withhold the inference response so the pending state is observable.
  ai.control.hold();

  await page.goto("/");

  // Structured (JSON-LD) paste import — the plain "Import" action, no AI needed
  // to create the recipe, so the only controlled call is provenance inference.
  await page.getByRole("button", { name: "Add Recipe" }).click();
  await page.getByRole("menuitem", { name: "Paste" }).click();
  await page.getByPlaceholder("Paste a recipe (free text) or JSON-LD here...").fill(JSON_LD);

  // Capture the import response to learn the created recipe id directly, so the
  // scenario does not depend on a dashboard card and the AI hold stays short.
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("recipes.importFromPaste")),
    page.getByRole("button", { name: "Import", exact: true }).click(),
  ]);

  const recipeId = (await response.text()).match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
  )?.[0];

  expect(recipeId).toBeTruthy();
  const recipeUrl = `/recipes/${recipeId}`;

  // Import stays responsive: the recipe is created asynchronously by the real
  // worker. Open recipe detail, retrying until it resolves from server truth.
  await expect(async () => {
    await page.goto(recipeUrl);
    await expect(page.getByRole("heading", { name: RECIPE_NAME }).first()).toBeVisible({
      timeout: 3_000,
    });
  }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });

  // Provenance-only pending state: the panel is present but shows no result yet,
  // while the rest of the recipe remains usable. (The responsive page renders a
  // desktop and a mobile copy; the desktop one is first in the DOM and visible,
  // so `.first()` targets it.)
  await expect(page.getByText("Origin", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Inferring origin/).first()).toBeAttached();
  await expect(page.getByText(PROVENANCE.region).first()).toHaveCount(0);
  await expect
    .poll(() => ai.control.requestCount, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  // Release the controlled response. The panel refreshes over the realtime
  // channel — no manual reload — to the persisted, final provenance.
  ai.control.release();

  await expect(page.getByText(PROVENANCE.region).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(PROVENANCE.note).first()).toBeVisible();
  await expect(page.getByText(PROVENANCE.cuisines[0]!, { exact: true }).first()).toBeVisible();

  // The known country flag prefixes the DISPLAYED title, while the title's
  // accessible name (and stored name) stays undecorated.
  const heading = page.getByRole("heading", { name: RECIPE_NAME, exact: true }).first();

  await expect(heading).toBeVisible();
  await expect(heading).toContainText("🇮🇹");

  // The persisted, editable name is unchanged — the edit form shows no flag.
  await page.goto(`/recipes/edit/${recipeId}`);
  await expect(page.getByRole("textbox", { name: "Recipe Name" })).toHaveValue(RECIPE_NAME);

  // The rendered country could only have come from the controlled provider.
  expect(ai.control.requestCount).toBeGreaterThanOrEqual(1);
});
