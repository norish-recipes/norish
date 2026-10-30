/*
 * Takes every capture the landing page shows, in both themes, from a running
 * Norish instance and writes them into `assets/screenshots`, ready for
 * `pnpm --filter @norish/landing shots`.
 *
 *   NORISH_URL=http://localhost:3000 \
 *   NORISH_EMAIL=demo@example.test NORISH_PASSWORD=... \
 *   NORISH_RECIPE_ID=<uuid of the recipe to open and cook> \
 *   NORISH_SCALE_RECIPE_ID=<uuid of the recipe shown scaled on the desktop> \
 *   node scripts/capture-shots.mjs
 *
 * Playwright resolves from the monorepo root. The account should already hold
 * the story described in assets/screenshots/README.md. Cooking mode advances to
 * step NORISH_COOK_STEP (default 3; pick one whose ingredient chips fit under
 * the instruction), and the desktop recipe is shown at NORISH_SERVINGS
 * (default 16). Every page is shot from its top with the pointer in a corner.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.NORISH_URL ?? "http://localhost:3000";
const EMAIL = process.env.NORISH_EMAIL;
const PASSWORD = process.env.NORISH_PASSWORD;
const RECIPE_ID = process.env.NORISH_RECIPE_ID;
const SCALE_RECIPE_ID = process.env.NORISH_SCALE_RECIPE_ID;
const COOK_STEP = Number(process.env.NORISH_COOK_STEP ?? 3);
const SERVINGS = Number(process.env.NORISH_SERVINGS ?? 16);

if (!EMAIL || !PASSWORD || !RECIPE_ID || !SCALE_RECIPE_ID) {
  console.error(
    "Set NORISH_EMAIL, NORISH_PASSWORD, NORISH_RECIPE_ID and NORISH_SCALE_RECIPE_ID (see file header)."
  );
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "screenshots");

/** Dev-only chrome that must never end up in a capture. */
const hideDevUi = `
  nextjs-portal, next-route-announcer, #next-build-watcher, [data-nextjs-toast],
  [data-next-badge-root], [data-nextjs-dev-tools-button] { display: none !important; }
`;

const PHONE = { width: 390, height: 773 };
const DESKTOP = { width: 1760, height: 1300 };

/* Norish keeps preferences per device kind, told apart by the user agent, so
   the phone pass has to look like a phone or it reads the desktop's. */
const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * A screen is only worth capturing once it has stopped being a skeleton. Falls
 * through with a warning rather than throwing, so one slow screen cannot strand
 * a run, but a warning means that capture wants checking before it is committed.
 */
async function settle(page, label) {
  await page
    .waitForFunction(
      () =>
        !document.querySelector(".skeleton") &&
        [...document.images].every((image) => image.complete),
      undefined,
      { timeout: 45_000, polling: 250 }
    )
    .catch(() => console.warn(`  ! ${label} was still loading when the wait ran out`));

  // Reveal animations and image decode land just after the data does.
  await sleep(1200);
}

async function signIn(context) {
  // Auth sign-in is rate limited; wait it out rather than fail halfway.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const login = await context.request.post(`${BASE}/api/auth/sign-in/email`, {
      data: { email: EMAIL, password: PASSWORD },
    });

    if (login.status() === 200) return;
    await sleep(15_000);
  }
  throw new Error("sign-in kept failing; check credentials or rate limit");
}

const browser = await chromium.launch();

for (const theme of ["light", "dark"]) {
  for (const [form, viewport] of [
    ["mobile", PHONE],
    ["web", DESKTOP],
  ]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
      extraHTTPHeaders: { origin: BASE },
      ...(form === "mobile" ? { userAgent: PHONE_UA } : {}),
    });

    await signIn(context);

    const page = await context.newPage();

    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);

    const open = async (path, label) => {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
      await settle(page, label);
    };

    const shoot = async (name) => {
      await page.addStyleTag({ content: hideDevUi }).catch(() => {});
      await page.mouse.move(1, viewport.height - 1);
      await sleep(400);
      await page.screenshot({
        path: join(outDir, `${name}-${theme}.jpg`),
        type: "jpeg",
        quality: 92,
      });
      console.log("captured", `${name}-${theme}`);
    };

    if (form === "web") {
      await open(`/recipes/${SCALE_RECIPE_ID}`, `recipe-web-${theme}`);

      const servings = page.getByRole("button", { name: /^\d+ servings$/ }).first();

      for (let tries = 0; tries < 40; tries += 1) {
        const now = Number((await servings.textContent())?.trim());

        if (now === SERVINGS) break;
        await page
          .getByRole("button", { name: now < SERVINGS ? "More servings" : "Fewer servings" })
          .first()
          .click();
        await sleep(250);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(800);
      await shoot("recipe-web");
    } else {
      await open(`/recipes/${RECIPE_ID}`, `recipe-mobile-${theme}`);
      await shoot("recipe-mobile");

      // Exact, because a step's timer can carry "cook" in its name too.
      await page.getByRole("button", { name: "Cook", exact: true }).first().click();
      await sleep(1500);
      for (let step = 1; step < COOK_STEP; step += 1) {
        await page.keyboard.press("ArrowDown");
        await sleep(900);
      }
      await shoot("cooking-mobile");

      await open("/calendar", `calendar-mobile-${theme}`);
      await shoot("calendar-mobile");

      await open("/groceries", `groceries-mobile-${theme}`);
      await shoot("groceries-mobile");

      await open("/groceries/pantry", `pantry-mobile-${theme}`);
      await shoot("pantry-mobile");
    }

    await context.close();
  }
}

await browser.close();
console.log("done; now run: pnpm --filter @norish/landing shots");
