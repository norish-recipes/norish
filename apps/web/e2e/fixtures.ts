import { readFile } from "node:fs/promises";
import path from "node:path";
import type { inferRouterProxyClient } from "@trpc/client";
import { test as base } from "@playwright/test";

import type { AppRouter } from "@norish/trpc";

import { createAuthenticatedApi } from "./support/api";

type Fixtures = {
  api: inferRouterProxyClient<AppRouter>;
  authSessionRoute: void;
};

type StoredSessionResponse = {
  cookieName: string;
  cookieValue: string;
  status: number;
  body: string;
};

type StoredSessions = {
  primary: StoredSessionResponse;
  secondary: StoredSessionResponse;
};

export const test = base.extend<Fixtures>({
  authSessionRoute: [
    async ({ context }, use) => {
      const sessions = JSON.parse(
        await readFile(path.resolve("e2e/.auth/session-responses.json"), "utf8")
      ) as StoredSessions;

      await context.route("**/api/auth/get-session", async (route) => {
        const cookie = await route.request().headerValue("cookie");
        const session = [sessions.primary, sessions.secondary].find((candidate) =>
          cookie?.includes(`${candidate.cookieName}=${candidate.cookieValue}`)
        );

        if (!session) {
          await route.continue();

          return;
        }

        // Keep the client pending through initial hydration so the intercepted
        // response matches the unauthenticated server-rendered navbar shape.
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.fulfill({
          status: session.status,
          contentType: "application/json",
          body: session.body,
        });
      });
      await use();
    },
    { auto: true },
  ],
  api: async ({ context, baseURL }, provide) => {
    if (!baseURL) throw new Error("Playwright baseURL is required");

    await provide(await createAuthenticatedApi(context, baseURL));
  },
});

export { expect } from "@playwright/test";
