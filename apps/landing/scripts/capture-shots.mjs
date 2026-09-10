/*
 * Takes all twenty tour captures (5 screens x web/mobile x light/dark) from a
 * running Norish instance and writes them into `assets/screenshots`, ready for
 * `pnpm --filter @norish/landing shots`.
 *
 *   NORISH_URL=http://localhost:3000 \
 *   NORISH_EMAIL=demo@example.test NORISH_PASSWORD=... \
 *   NORISH_RECIPE_ID=<uuid of the recipe to open and cook> \
 *   node scripts/capture-shots.mjs
 *
 * Playwright resolves from the monorepo root. The account should already hold
 * the seeded story described in assets/screenshots/README.md. Staged details
 * handled here: cooking mode advances to step 2 (whose ingredient chips sit
 * under the instruction), the mobile dashboard is captured in list view, and
 * the recipe page alone uses a wider web viewport so the page reads less
 * cramped.
 *
 * `NORISH_FORMS=mobile` (or `web`) takes half the set. The README's one
 * session rule still holds — a half run is for retaking a form whose layout
 * changed, not for topping up a set from a different day.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = process.env.NORISH_URL ?? "http://localhost:3000";
const EMAIL = process.env.NORISH_EMAIL;
const PASSWORD = process.env.NORISH_PASSWORD;
const RECIPE_ID = process.env.NORISH_RECIPE_ID;

if (!EMAIL || !PASSWORD || !RECIPE_ID) {
  console.error("Set NORISH_EMAIL, NORISH_PASSWORD and NORISH_RECIPE_ID (see file header).");
  process.exit(1);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "screenshots");

/** Dev-only chrome that must never end up in a capture. */
const hideDevUi = `
  nextjs-portal, next-route-announcer, #next-build-watcher, [data-nextjs-toast],
  [data-next-badge-root], [data-nextjs-dev-tools-button] { display: none !important; }
`;

const ALL_FORMS = {
  web: { width: 900, height: 675 },
  mobile: { width: 390, height: 773 },
};

const wanted = process.env.NORISH_FORMS?.split(",").map((form) => form.trim());
const FORMS = wanted
  ? Object.fromEntries(Object.entries(ALL_FORMS).filter(([form]) => wanted.includes(form)))
  : ALL_FORMS;

if (!Object.keys(FORMS).length) {
  console.error(`NORISH_FORMS must name one of: ${Object.keys(ALL_FORMS).join(", ")}`);
  process.exit(1);
}

/* The recipe page alone is captured at a physically wider viewport — same
   4:3, so the optimizer crops nothing, but the page gets room to breathe. */
const RECIPE_WEB = { width: 1200, height: 900 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/*
 * A screen is only worth capturing once it has stopped being a skeleton. The
 * library, the recipe photos and the planned week all arrive well after the
 * navigation itself settles, and a fixed sleep either wastes time or catches
 * a half-drawn frame. Falls through with a warning rather than throwing, so
 * one slow screen cannot strand a run that is otherwise fine — but a warning
 * means that capture wants checking before it is committed.
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

const browser = await chromium.launch();

for (const [form, viewport] of Object.entries(FORMS)) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      extraHTTPHeaders: { origin: BASE },
    });

    // Auth sign-in is rate limited; wait it out rather than fail four shots in.
    let signedIn = false;
    for (let attempt = 0; attempt < 8 && !signedIn; attempt += 1) {
      const login = await context.request.post(`${BASE}/api/auth/sign-in/email`, {
        data: { email: EMAIL, password: PASSWORD },
      });

      if (login.status() === 200) signedIn = true;
      else await sleep(15_000);
    }
    if (!signedIn) throw new Error("sign-in kept failing; check credentials or rate limit");

    // The mobile dashboard ships in list view. The choice is a device
    // preference cookie the server reads while it renders the library, so it
    // has to be in place before the first navigation, not set after hydration.
    if (form === "mobile") {
      await context.addCookies([
        { name: "norish_recipe_view_mode", value: "list", url: BASE, sameSite: "Lax" },
      ]);
    }

    const page = await context.newPage();

    await page.addInitScript((value) => window.localStorage.setItem("theme", value), theme);

    const shoot = async (name) => {
      await page.addStyleTag({ content: hideDevUi }).catch(() => {});
      await page.screenshot({
        path: join(outDir, `${name}-${form}-${theme}.jpg`),
        type: "jpeg",
        quality: 92,
      });
      console.log("captured", `${name}-${form}-${theme}`);
    };

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" }).catch(() => {});
    await settle(page, `dashboard-${form}-${theme}`);
    await shoot("dashboard");

    if (form === "web") await page.setViewportSize(RECIPE_WEB);
    await page.goto(`${BASE}/recipes/${RECIPE_ID}`, { waitUntil: "networkidle" }).catch(() => {});
    await settle(page, `recipe-${form}-${theme}`);
    await shoot("recipe");

    if (form === "web") {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(800);
    }

    await page.getByRole("button", { name: /cook/i }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(1200);
    await shoot("cooking");

    await page.goto(`${BASE}/calendar`, { waitUntil: "networkidle" }).catch(() => {});
    await settle(page, `calendar-${form}-${theme}`);
    await shoot("calendar");

    await page.goto(`${BASE}/groceries`, { waitUntil: "networkidle" }).catch(() => {});
    await settle(page, `groceries-${form}-${theme}`);
    await shoot("groceries");

    await context.close();
  }
}

await browser.close();
console.log("done; now run: pnpm --filter @norish/landing shots");
