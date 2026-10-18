import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { signIn } from "../harness/auth";
import { ProductionStack } from "../harness/production-stack";

/**
 * The web app served under a URL prefix (ADR-0040). This project runs only
 * against a build made with the same NEXT_PUBLIC_BASE_PATH: the prefix is
 * inlined into the client bundles, the service worker and the manifest at
 * build time.
 */
const BASE_PATH = "/norish";

const OWNER = {
  email: "base-path-owner@norish.test",
  password: "base-path-owner-password-1",
  name: "Base Path Owner",
};
const MEMBER = {
  email: "base-path-member@norish.test",
  password: "base-path-member-password-1",
  name: "Base Path Member",
};

let stack: ProductionStack;
let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(300_000);

test.beforeAll(async ({ browser }) => {
  if (process.env.NEXT_PUBLIC_BASE_PATH !== BASE_PATH) {
    throw new Error(
      `This project needs a build made with NEXT_PUBLIC_BASE_PATH=${BASE_PATH}; got ${process.env.NEXT_PUBLIC_BASE_PATH ?? "(empty)"}.`
    );
  }

  stack = new ProductionStack({
    project: "base-path",
    port: 3400,
    databaseName: "norish_base_path_e2e",
    basePath: BASE_PATH,
    users: [OWNER, MEMBER],
  });

  await stack.start();

  const cookies = await signIn(stack.baseURL, OWNER);

  context = await browser.newContext({
    baseURL: stack.baseURL,
    serviceWorkers: "allow",
    storageState: { cookies, origins: [] },
  });
  page = await context.newPage();
});

test.afterAll(async () => {
  await context?.close();
  await stack?.stop();
});

test("serves the page and every Next asset under the prefix", async () => {
  const assetStatuses: Array<{ url: string; status: number }> = [];

  page.on("response", (response) => {
    if (response.url().includes("/_next/")) {
      assetStatuses.push({ url: response.url(), status: response.status() });
    }
  });

  const response = await page.goto(BASE_PATH);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`${BASE_PATH}$`));
  await expect(page.locator("body")).toBeVisible();

  expect(assetStatuses.every(({ status }) => status < 400)).toBe(true);
  expect(assetStatuses.every(({ url }) => new URL(url).pathname.startsWith(`${BASE_PATH}/`))).toBe(
    true
  );
});

test("serves a manifest that starts and scopes at the prefix", async () => {
  await page.goto(BASE_PATH);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");

  expect(new URL(manifestHref!, stack.baseURL).pathname).toBe(`${BASE_PATH}/manifest.webmanifest`);

  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href!);

    return response.json() as Promise<{
      start_url: string;
      scope: string;
      icons: Array<{ src: string }>;
      screenshots: Array<{ src: string }>;
    }>;
  }, manifestHref);

  expect(manifest.start_url).toBe(BASE_PATH);
  expect(manifest.scope).toBe(BASE_PATH);
  expect(manifest.icons.every(({ src }) => src.startsWith(`${BASE_PATH}/`))).toBe(true);
  expect(manifest.screenshots.every(({ src }) => src.startsWith(`${BASE_PATH}/`))).toBe(true);
});

test("registers the service worker with the prefix as its scope", async () => {
  await page.goto(BASE_PATH);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const registration = await page.evaluate(async () => {
    const current = await navigator.serviceWorker.getRegistration();

    return {
      scope: current?.scope ?? null,
      scriptURL: navigator.serviceWorker.controller?.scriptURL ?? null,
    };
  });

  expect(registration.scope).toBe(stack.baseURL);
  expect(registration.scriptURL).toBe(`${stack.baseURL}/serwist/sw.js`);
});

test("keeps tRPC and the realtime socket under the prefix", async () => {
  const trpcStatuses: number[] = [];

  page.on("response", (response) => {
    if (response.url().includes(`${BASE_PATH}/api/trpc/`)) {
      trpcStatuses.push(response.status());
    }
  });

  await page.goto(BASE_PATH);
  await page.waitForLoadState("networkidle");
  await expect.poll(() => trpcStatuses.length).toBeGreaterThan(0);

  expect(trpcStatuses.every((status) => status < 400)).toBe(true);

  const health = await page.request.get(`${BASE_PATH}/api/v1/health`);

  expect(health.status()).toBe(200);
});

test("redirects to the prefixed login page when the session is absent", async () => {
  const anonymous = await context.browser()!.newContext({ baseURL: stack.baseURL });
  const anonymousPage = await anonymous.newPage();

  try {
    await anonymousPage.goto(`${BASE_PATH}/settings`);
    await expect(anonymousPage).toHaveURL(new RegExp(`${BASE_PATH}/login\\?callbackUrl=`));
  } finally {
    await anonymous.close();
  }
});

test("reloads a visited page while Offline", async () => {
  await page.goto(BASE_PATH);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);

  try {
    await page.reload();
    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${BASE_PATH}$`));
  } finally {
    await context.setOffline(false);
  }
});

test("keeps the offline home action under the prefix", async () => {
  await page.goto(BASE_PATH);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);

  try {
    await page.goto(`${BASE_PATH}/this-route-was-never-visited`);
    await expect(page.getByTestId("offline-unavailable")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("offline-unavailable").getByRole("button").nth(1).click();
    await expect(page).toHaveURL(new RegExp(`^${stack.baseURL}/?$`));
  } finally {
    await context.setOffline(false);
  }
});

test("signs out and back in at the prefix", async () => {
  await page.goto(BASE_PATH);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(new RegExp(`^${stack.baseURL}/login\\?logout=true$`));

  await page.locator('input[type="email"]').fill(OWNER.email);
  await page.locator('input[type="password"]').fill(OWNER.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp(`^${stack.baseURL}/?$`));
});
