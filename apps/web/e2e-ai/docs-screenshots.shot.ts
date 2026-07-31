/**
 * Capture the screenshots the documentation embeds.
 *
 * Runs against the production-like AI harness, so every image is of the real
 * application with real data — and can be regenerated when the UI moves, which
 * is the point of capturing them here rather than by hand.
 *
 * Images are written straight into `apps/docs/static/img/screenshots/`.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { AIE2EStack } from "@/e2e-ai/harness";
import type { BrowserContext, Locator, Page } from "@playwright/test";
import { E2E_BASE_URL, REPO_ROOT, USER_A } from "@/e2e-ai/env";
import { bootStack, setAutomaticEnrichment, signIn } from "@/e2e-ai/harness";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const SCREENSHOT_DIR = path.join(REPO_ROOT, "apps/docs/static/img/screenshots");

const RECIPE_NAME = "Cacio e Pepe";

/** A recipe with enough substance to make the captures look like real use. */
const RECIPE = {
  name: RECIPE_NAME,
  description: "Pasta, pecorino, and pepper — the whole dish in three ingredients.",
  notes: null,
  recipeYield: 2,
  // ISO 8601 durations: what the extraction schema asks for.
  prepTime: "PT5M",
  cookTime: "PT12M",
  totalTime: "PT17M",
  recipeIngredient: {
    metric: ["200 g spaghetti", "100 g pecorino romano", "2 g black peppercorns"],
    us: ["7 oz spaghetti", "3.5 oz pecorino romano", "1 tsp black peppercorns"],
  },
  recipeInstructions: {
    metric: [
      "Toast the peppercorns, then crush them coarsely.",
      "Boil the spaghetti in well-salted water until just shy of al dente.",
      "Loosen the grated pecorino with a little pasta water, then toss everything together off the heat.",
    ],
    us: [
      "Toast the peppercorns, then crush them coarsely.",
      "Boil the spaghetti in well-salted water until just shy of al dente.",
      "Loosen the grated pecorino with a little pasta water, then toss everything together off the heat.",
    ],
  },
  keywords: ["pasta", "quick meal"],
  allergyIndications: [],
  categories: ["Dinner"],
  nutrition: { calories: 620, fat: 24, carbs: 74, protein: 26 },
};

/** The provenance claim, as the model would return it. */
const PROVENANCE = {
  originCountry: "IT",
  originRegion: "Lazio",
  cuisines: ["Italian", "Mediterranean"],
  provenanceNote:
    "Questa ricetta è un classico della cucina romana: pochi ingredienti, tutti laziali, e nessun grasso aggiunto oltre al pecorino. La tecnica della crema di formaggio mantecata con l'acqua di cottura è tipica delle osterie di Roma.",
};

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

async function shoot(target: Page | Locator, name: string): Promise<void> {
  // Let fonts settle and any entrance animation finish, so captures are stable.
  await page.waitForTimeout(600);
  await target.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`) });
}

/**
 * Capture a fixed-height region starting at an anchor element.
 *
 * A plain element screenshot is wrong twice over for a long panel: the sticky
 * navbar paints over the top of it, and the full seeded Cuisine list makes an
 * image nobody reads. Anchoring on the panel's own heading and taking a fixed
 * height instead gives a readable crop that starts where the reader looks.
 */
async function shootRegion(anchor: Locator, name: string, height: number): Promise<void> {
  // `scrollIntoViewIfNeeded` shows the *bottom* of anything taller than the
  // viewport, which leaves the top — the part worth capturing — off-screen.
  await anchor.evaluate((element) => element.scrollIntoView({ block: "start" }));
  // Then clear the sticky navbar, so the clip contains content, not chrome.
  await page.evaluate(() => window.scrollBy(0, -96));
  await page.waitForTimeout(600);

  const box = await anchor.boundingBox();
  const viewport = page.viewportSize();

  if (!box || !viewport) throw new Error(`Cannot capture ${name}: no box or viewport`);

  const top = Math.max(box.y - 12, 0);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    clip: {
      x: box.x,
      y: top,
      width: Math.min(box.width, viewport.width - box.x),
      height: Math.min(height, viewport.height - top),
    },
  });
}

test.beforeAll(async ({ browser }) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  stack = await bootStack();

  const cookies = await signIn(USER_A);

  context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addCookies(cookies);
  page = await context.newPage();

  // Import one recipe and let automatic provenance inference fill it in — the
  // same path a reader's own recipes take.
  await setAutomaticEnrichment({ recipeProvenance: true });

  stack.ai.control.reset();
  stack.ai.control.enqueue(
    { kind: "success", content: JSON.stringify(RECIPE) },
    { kind: "success", content: JSON.stringify(PROVENANCE) }
  );
  stack.ai.control.setDefault(null);

  await page.goto("/");
  await expect(async () => {
    await page.getByRole("button", { name: "Add Recipe", exact: true }).click();
    await page.getByRole("menuitem", { name: "Paste" }).click({ timeout: 2_000 });
    await expect(
      page.getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000] });

  await page
    .getByPlaceholder("Paste a recipe (free text) or JSON-LD here...")
    .fill(`Import ${RECIPE_NAME} — the harness supplies the result.`);
  await page.getByRole("button", { name: "AI Import" }).click();

  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });
});

test.afterAll(async () => {
  await setAutomaticEnrichment({}).catch(() => undefined);
  await context?.close();
  await stack?.stop().catch(() => undefined);
  stack = null;
});

test("provenance on the recipe page", async () => {
  await page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);

  // Wait for the inference to land, then capture the section itself.
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Italy").first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  // The card titles itself with the country once one is known, so that heading
  // is what identifies it — there is no fixed section name to anchor on.
  const section = page
    .locator("div.md\\:block")
    .getByRole("heading", { name: "Italy", exact: true, level: 2 })
    .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");

  await shoot(section, "provenance-recipe");
});

test("the origin country's flag on the recipe title", async () => {
  // The docs claim the flag flies in front of the title, and the provenance
  // card's own crop cannot show it — the title sits outside that card.
  const title = page
    .locator("div.md\\:block")
    .getByRole("heading", { name: RECIPE_NAME, exact: true, level: 1 });

  await expect(title).toBeVisible({ timeout: 30_000 });
  await expect(title).toContainText("🇮🇹");

  await shootRegion(title, "provenance-title-flag", 120);
});

test("provenance in the recipe form", async () => {
  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/edit/${recipeId}`);

  const heading = page.getByRole("heading", { name: "Provenance" });

  // The form re-renders as the recipe's data arrives, which detaches whatever
  // was located a moment earlier. Retry until a scroll lands on a stable node.
  await expect(async () => {
    await expect(heading).toBeVisible({ timeout: 5_000 });
    await heading.scrollIntoViewIfNeeded({ timeout: 5_000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1_000, 2_000] });

  await shoot(
    page.locator("section").filter({ has: page.getByRole("heading", { name: "Provenance" }) }),
    "provenance-form"
  );
});

test("the Cuisine vocabulary in admin settings", async () => {
  await page.goto("/settings?tab=admin");

  const trigger = page.getByRole("button", { name: /^Cuisines/ }).first();

  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByText("Italian").first()).toBeVisible({ timeout: 30_000 });

  // Anchored on the Cuisines heading: the description, the add field, and the
  // first rows with their rename and delete actions. The full seeded list runs
  // to nearly forty rows and says nothing the first ten do not.
  await shootRegion(trigger, "admin-cuisines", 560);
});

test("the connection and offline status view", async () => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("button", { name: "Connection details" }).click();

  await expect(page.getByText("Connection & offline")).toBeVisible({ timeout: 15_000 });
  await shoot(page.getByRole("dialog").first(), "offline-status-modal");
});
