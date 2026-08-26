/*
 * Takes the six Cookbooks documentation captures from a running Norish dev
 * instance and writes them into `apps/docs/static/img/screenshots`.
 *
 *   NORISH_URL=http://localhost:3000 \
 *   NORISH_EMAIL=... NORISH_PASSWORD=... \
 *   node .scratch/cookbooks/capture-docs-shots.mjs
 *
 * Run from the monorepo root, where Playwright resolves. The account should
 * already hold a handful of recipes with pictures — the derived cover is a
 * mosaic of its members' images, so a library of imageless recipes documents
 * the plain tile instead.
 *
 * Reduced motion is mandatory: the Library heading rolls the word that names
 * the lit chip, and a capture taken mid-transition holds two of them at once.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.NORISH_URL ?? "http://localhost:3000";
const EMAIL = process.env.NORISH_EMAIL;
const PASSWORD = process.env.NORISH_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error("Set NORISH_EMAIL and NORISH_PASSWORD (see file header).");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "apps", "docs", "static", "img", "screenshots");

mkdirSync(outDir, { recursive: true });

/** Dev-only chrome that must never end up in a capture. */
const HIDE_DEV_UI = `
  nextjs-portal, next-route-announcer, #next-build-watcher, [data-nextjs-toast],
  [data-next-badge-root], [data-nextjs-dev-tools-button] { display: none !important; }
`;

const COOKBOOK_TITLE = "Weeknight dinners";
const SECOND_COOKBOOK = "Christmas baking";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A screen is only worth capturing once it has stopped being a skeleton. */
async function settle(page, label) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector(".skeleton") &&
        [...document.images].every((image) => image.complete),
      undefined,
      { timeout: 20_000 }
    )
    .catch(() => console.warn(`! ${label} still settling — check the capture`));
  await sleep(400);
}

async function shoot(target, name) {
  await target.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});

const page = await context.newPage();

await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});

// Sign in.
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page
  .getByLabel(/e-?mail/i)
  .first()
  .fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page
  .getByRole("button", { name: /sign in|log ?in/i })
  .first()
  .click();
await page.waitForURL((url) => !/\/login/.test(url.pathname), { timeout: 30_000 });
await settle(page, "dashboard");
await page.addStyleTag({ content: HIDE_DEV_UI });

const chip = (kind) => page.locator(`[data-library-type="${kind}"]`);
/*
 * A cookbook is described by the names of the recipes inside it, so matching
 * its title as bare text can land on a cookbook that merely holds it.
 */
const cookbookCard = (title) =>
  page.locator("[data-cookbook-card]").filter({ hasText: title }).first();
const library = page.locator("section[aria-labelledby='recipe-library-heading']");

/* ---- Staging: two cookbooks, the first holding a few recipes ---- */

async function ensureCookbook(title) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page, "dashboard");
  await chip("cookbooks").click();
  await sleep(600);

  if (
    await cookbookCard(title)
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }

  await page.getByTestId("add-cookbook-button").click();
  await page.getByTestId("cookbook-title-input").fill(title);
  await page.getByRole("button", { name: /^create$/i }).click();
  // Creating leaves the reader on the Library, so wait for the new card
  // rather than for a navigation that no longer happens.
  await cookbookCard(title).waitFor({ timeout: 20_000 });
  await settle(page, `cookbook ${title}`);
}

await ensureCookbook(SECOND_COOKBOOK);
await ensureCookbook(COOKBOOK_TITLE);

/** File the first few recipes on the Library into the named cookbook. */
async function fileRecipes(count) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await chip("recipes").click();
  await settle(page, "recipes");

  const cards = page.locator("[data-recipe-card]");
  const available = Math.min(count, await cards.count());

  for (let index = 0; index < available; index += 1) {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await settle(page, "recipes");
    await page.locator("[data-recipe-card]").nth(index).click();
    await page.waitForURL(/\/recipes\//, { timeout: 20_000 });
    await settle(page, "recipe page");

    const card = page.getByTestId("cookbooks-card").first();

    await card.getByTestId("file-into-cookbook").click();
    const toggle = page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`);

    await toggle.waitFor({ timeout: 10_000 });
    if ((await toggle.getAttribute("aria-pressed")) !== "true") {
      await toggle.click();
      await sleep(300);
      // Staged, not written: the panel commits on Save.
      await page.getByTestId("save-cookbook-membership").click();
    } else {
      await page.getByRole("button", { name: "Close panel" }).click();
    }
    await sleep(600);
  }
}

await fileRecipes(3);

/* ---- 1. The Library under All ---- */

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await chip("all").click();
await settle(page, "library");
await page.addStyleTag({ content: HIDE_DEV_UI });
await shoot(library, "cookbooks-library");

/* ---- 2. Creating a cookbook ---- */

await chip("cookbooks").click();
await sleep(600);
await page.getByTestId("add-cookbook-button").click();
await page.getByTestId("cookbook-title-input").fill("Sunday roasts");
await sleep(500);
await shoot(page.locator('[role="dialog"]').first(), "cookbooks-create");
await page.getByRole("button", { name: "Close panel" }).click();
await sleep(400);

/* ---- 3 & 4. The membership panel, and the recipe page's card ---- */

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await chip("recipes").click();
await settle(page, "recipes");
await page.locator("[data-recipe-card]").first().click();
await page.waitForURL(/\/recipes\//, { timeout: 20_000 });
await settle(page, "recipe page");
await page.addStyleTag({ content: HIDE_DEV_UI });

const recipeCard = page.getByTestId("cookbooks-card").first();

await recipeCard.scrollIntoViewIfNeeded();
await sleep(400);
await shoot(recipeCard, "cookbooks-recipe-card");

await recipeCard.getByTestId("file-into-cookbook").click();
await page.locator(`[data-cookbook-toggle="${COOKBOOK_TITLE}"]`).waitFor({ timeout: 10_000 });
await sleep(600);
await shoot(page.locator('[role="dialog"]').first(), "cookbooks-panel");
await page.getByRole("button", { name: "Close panel" }).click();

/* ---- 5. A cookbook's own page ---- */

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await chip("cookbooks").click();
await settle(page, "cookbooks");
await cookbookCard(COOKBOOK_TITLE).click();
await page.waitForURL(/\/cookbooks\//, { timeout: 20_000 });
await settle(page, "cookbook page");
await page.addStyleTag({ content: HIDE_DEV_UI });
await shoot(page.locator("section[aria-labelledby='cookbook-heading']"), "cookbooks-page");

/* ---- 6. Editing one: its name and what is in it, together ---- */

await page.getByRole("button", { name: "Cookbook options", exact: true }).click();
await page.getByRole("button", { name: "Edit cookbook", exact: true }).click();
await page.locator("[data-cookbook-member]").first().waitFor({ timeout: 10_000 });
await sleep(600);
await shoot(page.locator('[role="dialog"]').first(), "cookbooks-edit");
await page.getByRole("button", { name: "Close panel" }).click();

await browser.close();
console.log("done");
