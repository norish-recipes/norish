import type { BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import type { IdentityProvider } from "../../../../../packages/auth/__tests__/helpers/identity-provider";
import type { FakeAIProvider } from "../harness/ai-provider";
import type { SessionCookies } from "../harness/auth";
import {
  createIdentityProvider,
  IDP_CLIENT_ID,
} from "../../../../../packages/auth/__tests__/helpers/identity-provider";
import { createFakeAIProvider } from "../harness/ai-provider";
import { signIn } from "../harness/auth";
import { hydratingBrowser } from "../harness/hydration";
import { ProductionStack } from "../harness/production-stack";

export const OWNER = {
  email: "ai-e2e-a@norish.test",
  password: "ai-e2e-a-password-1",
  name: "AI E2E Owner",
};
export const MEMBER = {
  email: "ai-e2e-b@norish.test",
  password: "ai-e2e-b-password-1",
  name: "AI E2E Member",
};

export const IDP_NAME = "Test IdP";

export interface AIE2EStack {
  ai: FakeAIProvider;
  idp: IdentityProvider;
  server: ProductionStack;
  baseURL: string;
  ownerCookies: SessionCookies;
}

interface AITestFixtures {
  ai: FakeAIProvider;
  context: BrowserContext;
  page: Page;
}

interface AIWorkerFixtures {
  aiStack: AIE2EStack;
}

async function cleanup(
  ai: FakeAIProvider,
  idp: IdentityProvider,
  stack: ProductionStack
): Promise<void> {
  const results = await Promise.allSettled([stack.stop(), ai.stop(), idp.stop()]);
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(failures, "[ai] worker fixture cleanup failed");
  }
}

export const test = base.extend<AITestFixtures, AIWorkerFixtures>({
  browser: [async ({ browser }, use) => use(hydratingBrowser(browser)), { scope: "worker" }],
  aiStack: [
    async ({}, use) => {
      const ai = createFakeAIProvider();
      const idp = createIdentityProvider();

      await ai.start();
      // Better Auth reads OIDC discovery as the server boots.
      const issuer = await idp.start();
      const stack = new ProductionStack({
        project: "ai",
        databaseName: "norish_ai_e2e",
        users: [OWNER, MEMBER],
        environment: {
          AI_ENABLED: "true",
          AI_PROVIDER: "generic-openai",
          AI_ENDPOINT: ai.url,
          AI_MODEL: "test-model",
          AI_TEMPERATURE: "0",
          AI_MAX_TOKENS: "2048",
          AI_TIMEOUT_MS: "30000",
          OIDC_NAME: IDP_NAME,
          OIDC_ISSUER: issuer,
          OIDC_CLIENT_ID: IDP_CLIENT_ID,
          OIDC_CLIENT_SECRET: "secret",
        },
      });

      try {
        await stack.start();
        const ownerCookies = await signIn(stack.baseURL, OWNER);

        await use({ ai, idp, server: stack, baseURL: stack.baseURL, ownerCookies });
      } finally {
        await cleanup(ai, idp, stack);
      }
    },
    { scope: "worker" },
  ],

  ai: [
    async ({ aiStack }, use) => {
      aiStack.ai.control.reset();

      try {
        await use(aiStack.ai);
      } finally {
        aiStack.ai.control.reset();
      }
    },
    { auto: true },
  ],

  context: async ({ browser, aiStack }, use) => {
    const context = await browser.newContext({
      baseURL: aiStack.baseURL,
      storageState: { cookies: aiStack.ownerCookies, origins: [] },
      serviceWorkers: "allow",
    });

    try {
      await use(context);
    } finally {
      await context.close();
    }
  },

  page: async ({ context }, use) => {
    const page = await context.newPage();

    await use(page);
  },
});

export { expect };
export type { SessionCookies } from "../harness/auth";
export type { FakeAIProvider } from "../harness/ai-provider";
