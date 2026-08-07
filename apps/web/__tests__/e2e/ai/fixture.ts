import type { BrowserContext, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import type { FakeAIProvider } from "../harness/ai-provider";
import type { SessionCookies } from "../harness/auth";
import { createFakeAIProvider } from "../harness/ai-provider";
import { signIn } from "../harness/auth";
import { ProductionStack } from "../harness/production-stack";
import { configureDatabase } from "./database";

const OWNER = {
  email: "ai-e2e-a@norish.test",
  password: "ai-e2e-a-password-1",
  name: "AI E2E Owner",
};
const MEMBER = {
  email: "ai-e2e-b@norish.test",
  password: "ai-e2e-b-password-1",
  name: "AI E2E Member",
};

export interface AIE2EStack {
  ai: FakeAIProvider;
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

async function cleanup(ai: FakeAIProvider, stack: ProductionStack): Promise<void> {
  const results = await Promise.allSettled([stack.stop(), ai.stop()]);
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason);

  if (failures.length > 0) {
    throw new AggregateError(failures, "[ai] worker fixture cleanup failed");
  }
}

export const test = base.extend<AITestFixtures, AIWorkerFixtures>({
  aiStack: [
    async ({}, use) => {
      const ai = createFakeAIProvider();

      await ai.start();
      const stack = new ProductionStack({
        project: "ai",
        port: 3200,
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
        },
      });

      try {
        await stack.start();
        configureDatabase(stack.databaseUrl);
        const ownerCookies = await signIn(stack.baseURL, OWNER);

        await use({ ai, server: stack, baseURL: stack.baseURL, ownerCookies });
      } finally {
        await cleanup(ai, stack);
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
