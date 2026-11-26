// @vitest-environment node
/**
 * A Master Key rotation as a server goes through it, in file mode: boot on a key, sign up, make an
 * API key and a share link, rotate the key file, boot again. Real Postgres, real Valkey and Better
 * Auth's own sign-in, so a change in what Better Auth stores where fails here.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  createRecipeShare,
  getActiveRecipeShareByToken,
} from "@norish/db/repositories/recipe-shares";
import { readKeyFile, resolveMasterKey, writeKeyFile } from "@norish/shared-server/master-key";
import { getPublisherClient } from "@norish/shared-server/valkey/client";

import { createTestRecipe } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { startValkey, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { endStoredSessions } from "../../src/secondary-storage";

const AUTH_URL = SERVER_CONFIG.AUTH_URL;
const EMAIL = "ada@norish.test";
const PASSWORD = "ada-password-1";
// What else shares the Valkey database: a BullMQ job and a cache entry.
const FOREIGN = { job: "bull:caldav-sync:1", cache: "norish:pending-recipe-media:r1" };

type AuthModule = typeof import("@norish/auth/auth");

/** A fresh auth module, as a booted server builds it: on the Master Key open now. */
async function bootAuth(): Promise<AuthModule> {
  const { setAuthProviderCache } = await import("@norish/auth/provider-cache");

  setAuthProviderCache({ github: null, google: null, oidc: null, passwordEnabled: true });

  return import("@norish/auth/auth");
}

function request(route: string, init: { body?: unknown; headers?: Record<string, string> } = {}) {
  return new Request(`${AUTH_URL}/api/auth${route}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: AUTH_URL, ...init.headers },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

/** The `name=value` pairs a response sets, as a browser sends them back. */
const cookiesFrom = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");

async function sessionOf({ auth }: AuthModule, headers: Record<string, string>) {
  const response = await auth.handler(request("/get-session", { headers }));

  return (await response.json()) as { user: { id: string; email: string } } | null;
}

describe("a Master Key rotation at boot, over real Postgres and Valkey", () => {
  const testBase = new RepositoryTestBase("master_key_rotation_boot");
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);
  let container: StartedValkeyContainer;
  let before: { userId: string; cookie: string; apiKey: string; shareToken: string };
  let after: AuthModule;
  // The keys Valkey held just before the second boot, and after it.
  let stored: { before: string[]; after: string[] };

  beforeAll(async () => {
    await testBase.setup();
    container = await startValkey();
    SERVER_CONFIG.VALKEY_URL = valkeyUrl(container);
    SERVER_CONFIG.UPLOADS_DIR = mkdtempSync(path.join(os.tmpdir(), "master-key-rotation-"));
    SERVER_CONFIG.MASTER_KEY = undefined;
    SERVER_CONFIG.MASTER_KEY_PREVIOUS = undefined;
    const valkey = await getPublisherClient();

    // First boot on key A.
    await writeKeyFile({ current: keyA });
    await resolveMasterKey(endStoredSessions);
    const first = await bootAuth();
    const signUp = await first.auth.handler(
      request("/sign-up/email", { body: { email: EMAIL, password: PASSWORD, name: "Ada" } })
    );
    const cookie = cookiesFrom(signUp);
    const userId = (await sessionOf(first, { cookie }))?.user.id ?? "";
    const { key: apiKey } = await first.auth.api.createApiKey({
      body: { userId, name: "Scripts" },
    });
    const recipe = await createTestRecipe(userId);
    const share = await createRecipeShare(userId, { recipeId: recipe.id, expiresIn: "forever" });

    await (
      await first.auth.$context
    ).internalAdapter.createVerificationValue({
      identifier: "sign-in-state",
      value: "{}",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await valkey.hset(FOREIGN.job, { data: "{}" });
    await valkey.set(FOREIGN.cache, "[]");
    before = { userId, cookie, apiKey, shareToken: share.url.replace("/share/", "") };

    // The rotation: a new key in the file, the old one beside it, and a boot.
    await writeKeyFile({ current: keyB, previous: keyA }, { replace: true });
    stored = { before: await valkey.keys("*"), after: [] };
    await resolveMasterKey(endStoredSessions);
    stored.after = await valkey.keys("*");
    // A new process: every module evaluated again, on key B.
    vi.resetModules();
    after = await bootAuth();
  }, 240_000);

  afterAll(async () => {
    const { resetDbConnection } = await import("@norish/db/drizzle");

    await resetDbConnection();
    await (await getPublisherClient()).quit();
    await container?.stop();
    await testBase.teardown();
  });

  it("starts on the new key and drops the old one from the key file", async () => {
    expect(await readKeyFile()).toEqual({ current: keyB });
  });

  it("ends every session Better Auth stored in Valkey, and keeps every other key", async () => {
    const sessionKeys = stored.before.filter(
      (key) => key.startsWith("active-sessions-") || key.startsWith("verification:")
    );

    // There was something to end: a session list and the sign-in state.
    expect(sessionKeys).toHaveLength(2);
    expect(stored.after.filter((key) => sessionKeys.includes(key))).toEqual([]);
    expect(stored.after).toEqual(expect.arrayContaining(Object.values(FOREIGN)));

    const valkey = await getPublisherClient();

    for (const key of stored.after) {
      const value = (await valkey.type(key)) === "string" ? await valkey.get(key) : null;

      expect({ key, session: value?.includes(`"token":"${key}"`) ?? false }).toEqual({
        key,
        session: false,
      });
    }
    expect(await sessionOf(after, { cookie: before.cookie })).toBeNull();
  });

  it("signs in with the password, the account found by its email under the new key", async () => {
    const response = await after.auth.handler(
      request("/sign-in/email", { body: { email: EMAIL, password: PASSWORD } })
    );

    expect(response.status).toBe(200);
    expect(await sessionOf(after, { cookie: cookiesFrom(response) })).toMatchObject({
      user: { id: before.userId, email: EMAIL },
    });
  });

  it("authenticates a request with an API key made before the rotation", async () => {
    expect(await sessionOf(after, { "x-api-key": before.apiKey })).toMatchObject({
      user: { id: before.userId },
    });
  });

  it("opens the share link made before the rotation", async () => {
    expect(await getActiveRecipeShareByToken(before.shareToken)).toMatchObject({
      userId: before.userId,
    });
  });
});
