/**
 * The proxy only checks that a session cookie is present; the signed-in
 * layout and the media routes check the session behind it. What is proven
 * here is the reader's side of that split: a signed-out reader still lands on
 * the login page and comes back, an image is not served without a session,
 * and a share link's images still load signed out.
 */
import path from "node:path";
import { request } from "@playwright/test";

import { callTrpc } from "../harness/trpc";
import { seedRecipe } from "./cookbooks-support";
import { expect, OWNER, test } from "./fixture";
import { seedRecipePhoto } from "./image-generation-support";

const PHOTO = path.join(import.meta.dirname, "fixtures", "supplied-photo.jpg");

test("a signed-out reader opening a recipe signs in and comes back to it", async ({
  browser,
  aiStack,
}) => {
  const id = await seedRecipe("Gatekeeper Stew");
  const context = await browser.newContext({ baseURL: aiStack.baseURL });
  const page = await context.newPage();

  try {
    await page.goto(`/recipes/${id}`);
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);

    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/recipes/${id}$`), { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Gatekeeper Stew" })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await context.close();
  }
});

test("a recipe image is served to a signed-in reader and a share link, never without either", async ({
  aiStack,
}) => {
  const id = await seedRecipe("Picture Stew");
  const { url } = await seedRecipePhoto({
    recipeName: "Picture Stew",
    uploadsDir: aiStack.server.uploadsDir,
    photoPath: PHOTO,
    dishColor: "#884422",
  });
  const share = await callTrpc<{ url: string }>(
    aiStack.baseURL,
    aiStack.ownerCookies,
    "recipes.shareCreate",
    { recipeId: id }
  );
  const signedIn = await request.newContext({
    baseURL: aiStack.baseURL,
    extraHTTPHeaders: {
      cookie: aiStack.ownerCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    },
  });
  const signedOut = await request.newContext({ baseURL: aiStack.baseURL });

  try {
    expect((await signedIn.get(url)).status()).toBe(200);

    // A cookie the server does not know gets past the proxy, and then nothing.
    const forged = await signedOut.get(url, {
      headers: { cookie: "better-auth.session_token=forged" },
      maxRedirects: 0,
    });

    expect(forged.status()).toBe(404);
    expect(forged.headers()["cache-control"]).toBe("no-store");

    // Without any cookie the proxy sends the request to sign in.
    expect((await signedOut.get(url, { maxRedirects: 0 })).status()).toBe(307);

    // The share link's own copy of the image loads signed out.
    const shared = await signedOut.get(`${share.url}/media/${path.basename(url)}`);

    expect(shared.status()).toBe(200);
    expect(shared.headers()["content-type"]).toBe("image/jpeg");
  } finally {
    await Promise.all([signedIn.dispose(), signedOut.dispose()]);
  }
});

test("a share link's page shows its images signed out", async ({ browser, aiStack }) => {
  const id = await seedRecipe("Shared Picture Stew");

  await seedRecipePhoto({
    recipeName: "Shared Picture Stew",
    uploadsDir: aiStack.server.uploadsDir,
    photoPath: PHOTO,
    dishColor: "#884422",
  });
  const share = await callTrpc<{ url: string }>(
    aiStack.baseURL,
    aiStack.ownerCookies,
    "recipes.shareCreate",
    { recipeId: id }
  );
  const context = await browser.newContext({ baseURL: aiStack.baseURL });
  const page = await context.newPage();

  try {
    await page.goto(share.url);
    await expect(page.getByRole("heading", { name: "Shared Picture Stew" })).toBeVisible({
      timeout: 15_000,
    });

    const image = page.locator(`img[src*="/media/"]`).first();

    await expect(image).toBeVisible();
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
