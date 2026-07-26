/**
 * Reusable building blocks for production-like AI browser scenarios.
 *
 * A scenario boots the stack once (`bootStack`), signs users in against the
 * real auth API (`signIn`), and drives the deterministic provider through
 * `stack.ai.control`. This keeps every `.e2e.ts` free of harness
 * plumbing and free of scenario-specific coupling to the offline suite.
 */
import type { APIRequestContext } from "@playwright/test";
import { request } from "@playwright/test";
import { Client } from "pg";

import type { FakeAIProvider } from "./ai-provider";
import type { E2eServer } from "./server";
import { createFakeAIProvider } from "./ai-provider";
import { E2E_BASE_URL, E2E_DATABASE_URL, FAKE_AI_PORT } from "./env";
import { startServer } from "./server";

export { createFakeAIProvider } from "./ai-provider";
export type { AIProviderControl, Directive, FakeAIProvider } from "./ai-provider";
export { startServer } from "./server";
export type { E2eServer } from "./server";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

/** Sign in against the real auth API and return the resulting session cookies. */
export async function signIn(user: { email: string; password: string }): Promise<SessionCookies> {
  const api = await request.newContext({
    baseURL: E2E_BASE_URL,
    // Better Auth rejects auth POSTs without a trusted Origin.
    extraHTTPHeaders: { origin: E2E_BASE_URL },
  });

  try {
    const response = await api.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });

    if (!response.ok()) {
      throw new Error(`sign-in for ${user.email} failed: ${response.status()}`);
    }

    const state = await api.storageState();

    return state.cookies;
  } finally {
    await api.dispose();
  }
}

/**
 * Set the four Automatic Recipe Enrichment switches in the harness database.
 *
 * They are written straight into `ai_config` because the administrator UI is
 * not the subject under test. Server config is read from the database on every
 * call, so no restart and no cache flush is needed — and flushing Redis here
 * would drop the signed-in session.
 */
export async function setAutomaticEnrichment(
  switches: Partial<
    Record<
      "autoTagging" | "allergyDetection" | "autoCategorization" | "nutritionEstimation",
      boolean
    >
  >
): Promise<void> {
  const db = new Client({ connectionString: E2E_DATABASE_URL });

  await db.connect();

  try {
    await db.query(
      `update server_config
         set value = jsonb_set(value, '{automaticEnrichment}', $1::jsonb, true)
       where key = 'ai_config'`,
      [
        JSON.stringify({
          autoTagging: false,
          allergyDetection: false,
          autoCategorization: false,
          nutritionEstimation: false,
          ...switches,
        }),
      ]
    );
  } finally {
    await db.end();
  }
}

export interface AIE2EStack {
  ai: FakeAIProvider;
  server: E2eServer;
  stop(): Promise<void>;
}

/**
 * Start the deterministic AI provider and the production server, in that order
 * so the server can reach the provider the moment a job runs. Returns a single
 * `stop` that tears both down (server first, so no in-flight job outlives it).
 */
export async function bootStack(): Promise<AIE2EStack> {
  const ai = createFakeAIProvider({ port: FAKE_AI_PORT });

  await ai.start();

  let server: E2eServer;

  try {
    server = await startServer();
  } catch (error) {
    await ai.stop().catch(() => undefined);
    throw error;
  }

  return {
    ai,
    server,
    async stop() {
      await server.stop().catch(() => undefined);
      await ai.stop().catch(() => undefined);
    },
  };
}
