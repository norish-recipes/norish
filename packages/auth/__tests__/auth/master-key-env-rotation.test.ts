// @vitest-environment node
/**
 * A Master Key rotation in env mode, as a server goes through it: boot on MASTER_KEY, sign up, move
 * MASTER_KEY to a new key with the old one as MASTER_KEY_PREVIOUS, boot again. Real Postgres and Valkey.
 */
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { StartedValkeyContainer } from "@testcontainers/valkey";
import type { MockInstance } from "vitest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { masterKeyFingerprint } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getMasterKeyFingerprint } from "@norish/db/repositories/master-key";
import { serverLogger } from "@norish/shared-server/logger";
import { readKeyFile, resolveMasterKey } from "@norish/shared-server/master-key";
import { getPublisherClient } from "@norish/shared-server/valkey/client";

import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { startValkey, valkeyUrl } from "../../../shared-server/__tests__/helpers/valkey";
import { deleteSessionsAndVerifications } from "../../src/secondary-storage";

const AUTH_URL = SERVER_CONFIG.AUTH_URL;
const EMAIL = "grace@norish.test";
const PASSWORD = "grace-password-1";
const REKEYED = "Master Key re-keyed and every session ended";
const PREVIOUS_CAN_GO = "MASTER_KEY_PREVIOUS is no longer needed and can be removed";

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

/** Pin the key as an administrator sets MASTER_KEY and MASTER_KEY_PREVIOUS. */
function pin(current: Buffer, previous?: Buffer) {
  SERVER_CONFIG.MASTER_KEY = current.toString("base64");
  SERVER_CONFIG.MASTER_KEY_PREVIOUS = previous?.toString("base64");
}

/** The messages a logger spy took, each call's last argument. */
const messages = (spy: MockInstance) => spy.mock.calls.map((call) => call.at(-1));

/** One boot of `resolveMasterKey`, and what it said at info and warn. */
async function boot() {
  const info = vi.spyOn(serverLogger, "info");
  const warn = vi.spyOn(serverLogger, "warn");

  try {
    await resolveMasterKey(deleteSessionsAndVerifications);

    return { info: messages(info), warn: messages(warn) };
  } finally {
    info.mockRestore();
    warn.mockRestore();
  }
}

describe("a Master Key rotation in env mode, over real Postgres and Valkey", () => {
  const testBase = new RepositoryTestBase("master_key_env_rotation");
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);
  let container: StartedValkeyContainer;
  let before: { userId: string; cookie: string };
  let rotation: { info: unknown[]; warn: unknown[]; fingerprint: string | null };
  let secondStart: { info: unknown[]; warn: unknown[] };
  let after: AuthModule;

  beforeAll(async () => {
    await testBase.setup();
    container = await startValkey();
    SERVER_CONFIG.VALKEY_URL = valkeyUrl(container);
    SERVER_CONFIG.UPLOADS_DIR = mkdtempSync(path.join(os.tmpdir(), "master-key-env-rotation-"));

    // First boot, pinned on key A.
    pin(keyA);
    await resolveMasterKey(deleteSessionsAndVerifications);
    const first = await bootAuth();
    const signUp = await first.auth.handler(
      request("/sign-up/email", { body: { email: EMAIL, password: PASSWORD, name: "Grace" } })
    );
    const cookie = cookiesFrom(signUp);

    before = { userId: (await sessionOf(first, { cookie }))?.user.id ?? "", cookie };

    // The rotation: MASTER_KEY moves to key B, key A beside it as MASTER_KEY_PREVIOUS.
    pin(keyB, keyA);
    rotation = { ...(await boot()), fingerprint: await getMasterKeyFingerprint() };
    // The next start, MASTER_KEY_PREVIOUS not yet removed.
    secondStart = await boot();
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

  it("re-keys to MASTER_KEY, says MASTER_KEY_PREVIOUS can go and writes no key file", async () => {
    expect(before.userId).not.toBe("");
    expect(rotation.info).toContain(REKEYED);
    expect(rotation.warn).toContain(PREVIOUS_CAN_GO);
    expect(rotation.fingerprint).toBe(masterKeyFingerprint(keyB));
    expect(await readKeyFile()).toBeNull();
  });

  it("ends the session made before the rotation, and signs in under the new key", async () => {
    expect(await sessionOf(after, { cookie: before.cookie })).toBeNull();

    const response = await after.auth.handler(
      request("/sign-in/email", { body: { email: EMAIL, password: PASSWORD } })
    );

    expect(response.status).toBe(200);
    expect(await sessionOf(after, { cookie: cookiesFrom(response) })).toMatchObject({
      user: { id: before.userId, email: EMAIL },
    });
  });

  it("starts plainly the next time, and says again that MASTER_KEY_PREVIOUS can go", () => {
    expect(secondStart.info).not.toContain(REKEYED);
    expect(secondStart.info).toContain("Master Key opened");
    expect(secondStart.warn).toEqual([PREVIOUS_CAN_GO]);
  });

  it("refuses the old key alone afterwards", async () => {
    pin(keyA);

    await expect(resolveMasterKey(deleteSessionsAndVerifications)).rejects.toThrow(
      "MASTER_KEY is not the key this database is encrypted with."
    );
    expect(await getMasterKeyFingerprint()).toBe(masterKeyFingerprint(keyB));
  });
});
