import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import {
  createAuthenticatedApi,
  PRIMARY_HOUSEHOLD_ID,
  SECONDARY_HOUSEHOLD_ID,
  SECONDARY_RECIPE_ID,
  SECONDARY_RECIPE_NAME,
  seedPrimaryHousehold,
} from "@/e2e/support/api";
import { PRIMARY_USER, SECONDARY_USER, signUpThroughUi } from "@/e2e/support/auth";
import { test as setup } from "@playwright/test";

const authDirectory = path.resolve("e2e/.auth");
const primaryStorageState = path.join(authDirectory, "primary.json");
const secondaryStorageState = path.join(authDirectory, "secondary.json");
const sessionResponses = path.join(authDirectory, "session-responses.json");

function waitForAuthenticatedSessionResponse(page: Page) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Timed out waiting for the authenticated session response")),
      60_000
    );

    const onResponse = async (response: Parameters<Parameters<Page["on"]>[1]>[0]) => {
      if (!response.url().includes("/api/auth/get-session") || !response.ok()) return;

      const body = await response.text();
      const value = JSON.parse(body) as { user?: unknown } | null;

      if (!value?.user) return;

      clearTimeout(timeout);
      page.off("response", onResponse);
      resolve({ status: response.status(), body });
    };

    page.on("response", onResponse);
  });
}

async function addSessionCookie(
  context: BrowserContext,
  baseURL: string,
  response: { status: number; body: string }
) {
  const sessionCookie = (await context.cookies(baseURL)).find((cookie) =>
    cookie.name.includes("session_token")
  );

  if (!sessionCookie) throw new Error("Session fixture cookie was not found");

  return {
    cookieName: sessionCookie.name,
    cookieValue: sessionCookie.value,
    ...response,
  };
}

setup("signs up and seeds authenticated browser fixtures", async ({ browser, baseURL }) => {
  setup.setTimeout(120_000);

  if (!baseURL) throw new Error("Playwright baseURL is required");

  await mkdir(authDirectory, { recursive: true });
  const primaryContext = await browser.newContext({ baseURL });
  const primaryPage = await primaryContext.newPage();
  const primarySessionResponse = waitForAuthenticatedSessionResponse(primaryPage);

  await signUpThroughUi(primaryPage, PRIMARY_USER);
  const primaryApi = await createAuthenticatedApi(primaryContext, baseURL);

  await primaryApi.households.create.mutate({
    id: PRIMARY_HOUSEHOLD_ID,
    name: "Primary E2E Household",
  });
  await seedPrimaryHousehold(primaryApi);
  await primaryApi.admin.updateRegistration.mutate(true);
  await primaryContext.storageState({ path: primaryStorageState });
  const primarySession = await addSessionCookie(
    primaryContext,
    baseURL,
    await primarySessionResponse
  );

  const secondaryContext = await browser.newContext({ baseURL });
  const secondaryPage = await secondaryContext.newPage();
  const secondarySessionResponse = waitForAuthenticatedSessionResponse(secondaryPage);

  await signUpThroughUi(secondaryPage, SECONDARY_USER);
  const secondaryApi = await createAuthenticatedApi(secondaryContext, baseURL);

  await secondaryApi.households.create.mutate({
    id: SECONDARY_HOUSEHOLD_ID,
    name: "Secondary E2E Household",
  });
  await secondaryApi.recipes.create.mutate({
    id: SECONDARY_RECIPE_ID,
    name: SECONDARY_RECIPE_NAME,
    systemUsed: "metric",
    recipeIngredients: [],
    steps: [],
    tags: [],
  });
  await secondaryContext.storageState({ path: secondaryStorageState });
  const secondarySession = await addSessionCookie(
    secondaryContext,
    baseURL,
    await secondarySessionResponse
  );

  await writeFile(
    sessionResponses,
    JSON.stringify({ primary: primarySession, secondary: secondarySession }),
    "utf8"
  );

  await secondaryContext.close();
  await primaryContext.close();
});
