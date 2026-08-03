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
import {
  bootStack,
  readStoredStepIngredients,
  setAutomaticEnrichment,
  signIn,
  submitPasteImport,
} from "@/e2e-ai/harness";
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
    metric: ["200 g spaghetti", "100 g pecorino romano", "2 grams black peppercorns"],
    us: ["7 oz spaghetti", "3.5 oz pecorino romano", "1 tsp black peppercorns"],
  },
  recipeInstructions: {
    metric: [
      "# Preparazione",
      "Toast the peppercorns, then crush them coarsely.",
      "Boil the spaghetti in well-salted water until just shy of al dente.",
      "Loosen the grated pecorino with a little pasta water, then toss everything together off the heat.",
    ],
    us: [
      "# Preparazione",
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

/**
 * The Step Ingredient links, as the model would return them: the prompt's own
 * 1-based numbering over the linkable (non-heading) lines and steps, each
 * stating a share or an amount, never both.
 */
const LINKING = {
  links: [
    { step: 1, ingredients: [{ line: 3, share: 1, amount: null }] },
    { step: 2, ingredients: [{ line: 1, share: 1, amount: null }] },
    { step: 3, ingredients: [{ line: 2, share: 1, amount: null }] },
  ],
};

/** The provenance claim, as the model would return it. */
const PROVENANCE = {
  originCountry: "IT",
  originCountryName: "Italia",
  originRegion: "Lazio",
  cuisines: ["Italian", "Mediterranean"],
  provenanceNote:
    "Questa ricetta è un classico della cucina romana: pochi ingredienti, tutti laziali, e nessun grasso aggiunto oltre al pecorino. La tecnica della crema di formaggio mantecata con l'acqua di cottura è tipica delle osterie di Roma.",
};

let stack: AIE2EStack | null = null;
let context: BrowserContext;
let page: Page;

async function shoot(target: Page | Locator, name: string): Promise<void> {
  // Wait for fonts by their own signal; finite animations are disabled and
  // fast-forwarded by the screenshot call itself, so captures are stable. The
  // capture retries as a unit: an entrance re-render can swap the resolved
  // node out of the DOM between locating it and photographing it.
  await page.evaluate(() => document.fonts.ready);
  await expect(async () => {
    await target.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      animations: "disabled",
    });
  }).toPass({ timeout: 15_000, intervals: [250, 500, 1_000] });
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
  // Retried as a unit: a re-render can detach the anchor between the scroll
  // and the capture, and the retry re-resolves it.
  await expect(async () => {
    // `scrollIntoViewIfNeeded` shows the *bottom* of anything taller than the
    // viewport, which leaves the top — the part worth capturing — off-screen.
    await anchor.evaluate((element) => element.scrollIntoView({ block: "start" }));
    // Then clear the sticky navbar, so the clip contains content, not chrome.
    await page.evaluate(() => window.scrollBy(0, -96));
    await page.evaluate(() => document.fonts.ready);

    const box = await anchor.boundingBox();
    const viewport = page.viewportSize();

    if (!box || !viewport) throw new Error(`Cannot capture ${name}: no box or viewport`);

    const top = Math.max(box.y - 12, 0);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${name}.png`),
      animations: "disabled",
      clip: {
        x: box.x,
        y: top,
        width: Math.min(box.width, viewport.width - box.x),
        height: Math.min(height, viewport.height - top),
      },
    });
  }).toPass({ timeout: 15_000, intervals: [250, 500, 1_000] });
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
  await submitPasteImport(page, `Import ${RECIPE_NAME} — the harness supplies the result.`);

  await expect(async () => {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 })
    ).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  // Link the steps through the real actions-menu path, so the amounts the
  // captures show came the way a reader's own would.
  await page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);
  stack.ai.control.succeedWith(LINKING);
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Link Ingredients to Steps" }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(async () => (await readStoredStepIngredients(RECIPE_NAME)).length, {
      timeout: 60_000,
    })
    .toBeGreaterThan(0);

  // Every capture starts from the dashboard, like the tests before this ran.
  await page.goto("/");
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
    await expect(page.getByText("Italia").first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 5_000] });

  // The card titles itself with the country once one is known, so that heading
  // is what identifies it — there is no fixed section name to anchor on.
  const section = page
    .locator("div.md\\:block")
    .getByRole("heading", { name: "Italia", exact: true, level: 2 })
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

test("a form section heading, written with #", async () => {
  // Still on the edit form from the previous capture. The Instructions field
  // shows the "# Preparazione" row rendered as a heading row, unnumbered.
  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });

  await expect(instructions.getByRole("textbox").first()).toHaveValue("# Preparazione", {
    timeout: 15_000,
  });
  await shootRegion(
    instructions.getByRole("heading", { name: "Instructions" }),
    "editor-section-heading",
    420
  );
});

test("the / recipe-link autocomplete, open over a step", async () => {
  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });
  const stepBoxes = instructions.getByRole("textbox");
  // Pin the trailing row by index: typing into it auto-appends a new empty
  // row, so `.last()` would re-resolve to that one and crop the wrong spot.
  const trailingIndex = (await stepBoxes.count()) - 1;
  const target = stepBoxes.nth(trailingIndex);

  await target.scrollIntoViewIfNeeded();
  await target.click();
  await target.fill("Serve with /Cacio");

  // The popover offers the recipe found by the real autocomplete query.
  await expect(
    page.getByRole("listbox", { name: "Recipe suggestions" }).getByText(RECIPE_NAME)
  ).toBeVisible({ timeout: 15_000 });
  await shootRegion(target, "editor-recipe-link-autocomplete", 320);
  await target.fill("");
});

test("the @ mention autocomplete, with chips beneath the step", async () => {
  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });
  // The toast step carries its peppercorn chip from the linking run; typing
  // in the same step shows the gesture and the chip it produces side by side.
  const toastStep = instructions.getByRole("textbox").nth(1);

  await toastStep.scrollIntoViewIfNeeded();
  await toastStep.click();
  await toastStep.fill("Toast the peppercorns, then crush them coarsely. Reserve @pec");

  await expect(page.getByText("pecorino romano").first()).toBeVisible({ timeout: 15_000 });
  await shootRegion(toastStep, "editor-mention-chips", 360);
});

test("amount entry on a chip beneath a step", async () => {
  // Self-sufficient navigation, so this capture can be regenerated alone:
  // from the dashboard to the recipe, then into its edit form.
  await page.goto("/");
  await page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);

  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/edit/${recipeId}`);

  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });
  const toastStep = instructions.getByRole("textbox").nth(1);

  await expect(toastStep).toHaveValue(/Toast the peppercorns/, { timeout: 30_000 });
  await toastStep.scrollIntoViewIfNeeded();

  // The peppercorn chip the linking run attached: its menu offers the share
  // presets and, because the line has an amount, Amount… entry.
  await page.getByRole("button", { name: "Change the share of black peppercorns" }).click();
  await expect(page.getByRole("menuitem", { name: "Amount…" })).toBeVisible({ timeout: 15_000 });

  await shootRegion(toastStep, "editor-amount-entry", 400);
  await page.keyboard.press("Escape");
});

test("the ask after attaching from the picker", async () => {
  // Self-sufficient navigation, like the capture before it: attaching an
  // amounted line opens the ask over the fresh chip, prefilled with the
  // whole line.
  await page.goto("/");
  await page.getByRole("heading", { name: RECIPE_NAME, exact: true, level: 3 }).click();
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);

  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/edit/${recipeId}`);

  const instructions = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Instructions" }) });
  const toastStep = instructions.getByRole("textbox").nth(1);

  await expect(toastStep).toHaveValue(/Toast the peppercorns/, { timeout: 30_000 });
  await toastStep.scrollIntoViewIfNeeded();
  await instructions.getByRole("button", { name: "Link ingredient" }).first().click();
  await page.getByRole("menuitem", { name: "spaghetti", exact: true }).click();

  const ask = page.getByRole("spinbutton", { name: "Amount" });

  await expect(ask).toBeFocused({ timeout: 15_000 });
  await expect(ask).toHaveValue("200");

  await shootRegion(toastStep, "editor-amount-ask", 400);

  // Put the form back exactly as it was, so later captures navigate freely.
  // First: the boil step carries its own linked spaghetti chip further down.
  await instructions.getByRole("button", { name: "Remove spaghetti" }).first().click();
  await expect(instructions.getByText("200 g spaghetti")).not.toBeVisible();
});

test("amounts under a step on the recipe page", async () => {
  const recipeId = new URL(page.url()).pathname.split("/").pop();

  await page.goto(`/recipes/${recipeId}`);

  const steps = page
    .locator("div.md\\:block")
    .getByRole("heading", { name: "Steps", exact: true })
    .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");

  await expect(steps.getByText("2 grams black peppercorns").first()).toBeVisible({
    timeout: 30_000,
  });
  // The whole steps card: the heading's own box is only as wide as its text,
  // which makes a useless sliver of a crop.
  await shoot(steps, "step-ingredients-recipe");
});

test("cooking mode showing the step's ingredients", async () => {
  await page.getByRole("button", { name: "Cook", exact: true }).first().click();

  const dialog = page.getByRole("dialog").first();

  await expect(dialog.getByText("2 grams black peppercorns").first()).toBeVisible({
    timeout: 15_000,
  });
  await shoot(dialog, "step-ingredients-cooking-mode");
  await page.keyboard.press("Escape");
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
