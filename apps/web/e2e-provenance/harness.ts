/**
 * Reusable building blocks for recipe-provenance browser scenarios.
 *
 * A scenario boots the stack once (`bootStack`), signs users in against the
 * real auth API (`signIn`), and drives the deterministic provider through
 * `stack.ai.control`. This keeps every provenance `.e2e.ts` free of harness
 * plumbing and free of provenance-specific coupling to the offline suite.
 */
import type { APIRequestContext } from "@playwright/test";
import { request } from "@playwright/test";

import type { FakeAIProvider } from "./ai-provider";
import type { E2eServer } from "./server";
import { createFakeAIProvider } from "./ai-provider";
import { FAKE_AI_PORT, PROV_BASE_URL } from "./env";
import { startServer } from "./server";

export { createFakeAIProvider } from "./ai-provider";
export type { AIProviderControl, Directive, FakeAIProvider } from "./ai-provider";
export { startServer } from "./server";
export type { E2eServer } from "./server";

export type SessionCookies = Awaited<ReturnType<APIRequestContext["storageState"]>>["cookies"];

/** Sign in against the real auth API and return the resulting session cookies. */
export async function signIn(user: { email: string; password: string }): Promise<SessionCookies> {
  const api = await request.newContext({
    baseURL: PROV_BASE_URL,
    // Better Auth rejects auth POSTs without a trusted Origin.
    extraHTTPHeaders: { origin: PROV_BASE_URL },
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

export interface ProvenanceStack {
  ai: FakeAIProvider;
  server: E2eServer;
  stop(): Promise<void>;
}

/**
 * Start the deterministic AI provider and the production server, in that order
 * so the server can reach the provider the moment a job runs. Returns a single
 * `stop` that tears both down (server first, so no in-flight job outlives it).
 */
export async function bootStack(): Promise<ProvenanceStack> {
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
