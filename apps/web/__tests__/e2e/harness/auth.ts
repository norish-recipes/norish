import type {
  APIRequestContext,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Locator,
  Page,
} from "@playwright/test";
import { request } from "@playwright/test";

import type { HarnessUser } from "./production-stack";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

export async function signIn(
  baseURL: string,
  user: Pick<HarnessUser, "email" | "password">
): Promise<SessionCookies> {
  // A root-relative path would drop the base path from baseURL, so the request URL is absolute.
  const api = await request.newContext({ extraHTTPHeaders: { origin: new URL(baseURL).origin } });

  try {
    const response = await api.post(`${baseURL}/api/auth/sign-in/email`, {
      data: { email: user.email, password: user.password },
    });

    if (!response.ok()) {
      throw new Error(`sign-in for ${user.email} failed: ${response.status()}`);
    }

    return (await api.storageState()).cookies;
  } finally {
    await api.dispose();
  }
}

/** A browser context signed in as the user. */
export async function signedInContext(
  browser: Browser,
  baseURL: string,
  user: Pick<HarnessUser, "email" | "password">,
  options: BrowserContextOptions = {}
): Promise<BrowserContext> {
  return browser.newContext({
    ...options,
    baseURL,
    storageState: { cookies: await signIn(baseURL, user), origins: [] },
  });
}

/** The settings card with this title. */
export function settingsCard(page: Page, title: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
