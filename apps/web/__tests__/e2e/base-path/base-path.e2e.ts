import type { Locator } from "@playwright/test";

import { BUILT_BASE_PATH } from "../harness/build";
import { AVATAR, expect, GROCERY_NAME, OWNER, RECIPE_ID, RECIPE_NAME, test } from "./fixture";

test.describe.configure({ mode: "serial" });

// The guard against a URL that misses the prefix: every scenario ends with no stray request.
test.afterEach(({ basePath }) => {
  expect(basePath.strays).toEqual([]);
});

/** Until the image has loaded its file, which a URL outside the base path never does. */
async function expectLoaded(image: Locator): Promise<void> {
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
}

test("serves every surface, its assets and its media under the base path", async ({
  basePath: { at, page },
}) => {
  await page.goto(at("/"));
  await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
  await expectLoaded(page.locator(`img[src="${BUILT_BASE_PATH}/avatars/${AVATAR}"]`).first());

  await page.goto(at(`/recipes/${RECIPE_ID}`));
  await expect(page.getByRole("heading", { name: RECIPE_NAME })).toBeVisible();
  await expectLoaded(
    page.locator(`img[src="${BUILT_BASE_PATH}/recipes/${RECIPE_ID}/primary.png"]`).first()
  );
  await expectLoaded(
    page.locator(`img[src="${BUILT_BASE_PATH}/recipes/${RECIPE_ID}/steps/step.png"]`).first()
  );

  await page.goto(at("/calendar"));
  await expectLoaded(
    page.locator(`img[src="${BUILT_BASE_PATH}/recipes/${RECIPE_ID}/primary.png"]`).first()
  );

  await page.goto(at("/groceries"));
  await expect(page.getByText(GROCERY_NAME)).toBeVisible();
  await page.getByRole("tab", { name: "Pantry" }).click();
  await expect(page).toHaveURL(at("/groceries/pantry"));

  await page.goto(at("/settings?tab=user"));
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});

test("serves a manifest that starts and scopes at the base path", async ({
  basePath: { at, page },
}) => {
  await page.goto(at("/"));

  const href = await page.locator('link[rel="manifest"]').getAttribute("href");

  expect(href).toBe(`${BUILT_BASE_PATH}/manifest.webmanifest`);

  const manifest = (await (await page.request.get(at("/manifest.webmanifest"))).json()) as {
    start_url: string;
    scope: string;
    icons: Array<{ src: string }>;
    screenshots: Array<{ src: string }>;
  };

  expect(manifest.start_url).toBe(BUILT_BASE_PATH);
  expect(manifest.scope).toBe(BUILT_BASE_PATH);

  for (const { src } of [...manifest.icons, ...manifest.screenshots]) {
    expect(src.startsWith(`${BUILT_BASE_PATH}/`)).toBe(true);
  }
});

test("registers the service worker with the base path as its scope", async ({
  basePath: { at, baseURL, page },
}) => {
  await page.goto(at("/"));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const registration = await page.evaluate(async () => ({
    scope: (await navigator.serviceWorker.getRegistration())?.scope,
    script: navigator.serviceWorker.controller?.scriptURL,
  }));

  expect(registration).toEqual({ scope: baseURL, script: `${baseURL}/serwist/sw.js` });
});

test("opens the realtime socket under the base path", async ({
  basePath: { at, origin, page },
}) => {
  const socket = page.waitForEvent("websocket", (candidate) => candidate.url().endsWith("/trpc"));

  await page.goto(at("/"));

  const opened = await socket;

  expect(opened.url()).toBe(`${origin.replace("http", "ws")}${BUILT_BASE_PATH}/trpc`);
  await opened.waitForEvent("framereceived");
  expect(opened.isClosed()).toBe(false);
});

test("sends a signed-out reader to sign in and back to where they were", async ({
  basePath: { at, context },
}) => {
  const browser = context.browser();

  if (!browser) throw new Error("The context has no browser");

  const anonymous = await browser.newContext({ serviceWorkers: "block" });
  const page = await anonymous.newPage();

  try {
    await page.goto(at("/settings"));
    await expect(page).toHaveURL(
      at(`/login?callbackUrl=${encodeURIComponent(`${BUILT_BASE_PATH}/settings`)}`)
    );

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(at("/settings"), { timeout: 15_000 });
  } finally {
    await anonymous.close();
  }
});

test("reloads a visited page while Offline", async ({ basePath: { at, context, page } }) => {
  await page.goto(at("/"));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);

  try {
    await page.reload();
    await expect(page).toHaveURL(at("/"));
    await expect(page.getByRole("button", { name: "Open user menu" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test("opens a warmed surface while Offline", async ({ basePath: { at, context, page } }) => {
  await page.goto(at("/groceries"));
  await expect(page.getByText(GROCERY_NAME)).toBeVisible();
  await page.goto(at("/"));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  // Drop the cached document, so Offline the app shell has to place the path itself.
  await page.evaluate(async () => {
    const names = await caches.keys();

    await Promise.all(names.filter((name) => name.includes("pages")).map((n) => caches.delete(n)));
  });
  await context.setOffline(true);

  try {
    await page.goto(at("/groceries"));
    await expect(page.getByText(GROCERY_NAME)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("offline-unavailable")).toHaveCount(0);
  } finally {
    await context.setOffline(false);
  }
});

test("takes the Offline home action to the base path", async ({
  basePath: { at, context, page },
}) => {
  await page.goto(at("/"));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);

  try {
    await page.goto(at("/this-route-was-never-visited"));
    await expect(page.getByTestId("offline-unavailable")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Open Norish" }).click();
    await expect(page).toHaveURL(at("/"));
  } finally {
    await context.setOffline(false);
  }
});

test("downloads the recipe archive under the base path", async ({ basePath: { at, page } }) => {
  await page.goto(at("/settings?tab=user"));

  const exported = page.waitForRequest((request) =>
    new URL(request.url()).pathname.endsWith("/export/recipes")
  );

  await page.getByRole("button", { name: "Export", exact: true }).click();

  expect(new URL((await exported).url()).pathname).toBe(`${BUILT_BASE_PATH}/export/recipes`);
});

test("signs out to the base path's login page", async ({ basePath: { at, page } }) => {
  await page.goto(at("/"));
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(at("/login?logout=true"));
});
