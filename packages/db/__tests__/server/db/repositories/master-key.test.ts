// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { decrypt, masterKeyFingerprint } from "@norish/config/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  claimMasterKeyFingerprint,
  countEncryptedRows,
  findNewestCiphertext,
} from "@norish/db/repositories/master-key";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { serverConfig, users } from "@norish/db/schema";

import { cleanDatabase, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("what boot checks a Master Key against", () => {
  const testBase = new RepositoryTestBase("master_key");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await getTestDb().delete(serverConfig);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("finds nothing encrypted on an instance with no accounts and no secret settings", async () => {
    await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, true, null, false);

    expect(await countEncryptedRows()).toBe(0);
    expect(await findNewestCiphertext()).toBeNull();
  });

  it("counts every account and every secret setting", async () => {
    await createTestUser({ email: "ada@example.com" });
    await createTestUser({ email: "grace@example.com" });
    await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, true, null, false);
    await setConfig(
      ServerConfigKeys.IMAGE_GENERATION_CONFIG,
      { provider: "openai", model: "gpt-image-1", apiKey: "openai-key" },
      null,
      true
    );

    expect(await countEncryptedRows()).toBe(3);
  });

  it("counts an account whose stored email is empty", async () => {
    await createTestUser({ email: "ada@example.com" });
    await getTestDb().update(users).set({ email: "" });

    expect(await countEncryptedRows()).toBe(1);
    expect(await findNewestCiphertext()).toBe("");
  });

  it("finds the newest account's email", async () => {
    await createTestUser({ email: "old@example.com", createdAt: new Date("2026-01-01") });
    await createTestUser({ email: "new@example.com", createdAt: new Date("2026-06-01") });

    const written = await findNewestCiphertext();

    expect(written && decrypt(written)).toBe("new@example.com");
  });

  it("finds the newest secret setting on an instance with no accounts", async () => {
    await setConfig(ServerConfigKeys.REGISTRATION_ENABLED, true, null, false);
    await setConfig(
      ServerConfigKeys.IMAGE_GENERATION_CONFIG,
      { provider: "openai", model: "gpt-image-1", apiKey: "openai-key" },
      null,
      true
    );

    const written = await findNewestCiphertext();

    expect(written && JSON.parse(decrypt(written))).toMatchObject({ apiKey: "openai-key" });
  });

  it("keeps the fingerprint in plain text", async () => {
    const fingerprint = masterKeyFingerprint(Buffer.alloc(32, 7));

    await setConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT, fingerprint, null, false);

    const [row] = await getTestDb()
      .select()
      .from(serverConfig)
      .where(eq(serverConfig.key, ServerConfigKeys.MASTER_KEY_FINGERPRINT));

    expect(row).toMatchObject({ value: fingerprint, valueEnc: null, isSensitive: false });
    expect(await getConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT)).toBe(fingerprint);
  });

  it("claims the fingerprint for the first key, and keeps it from a second", async () => {
    const first = masterKeyFingerprint(Buffer.alloc(32, 1));
    const second = masterKeyFingerprint(Buffer.alloc(32, 2));

    expect(await claimMasterKeyFingerprint(first)).toBe(first);
    expect(await claimMasterKeyFingerprint(second)).toBe(first);
    expect(await getConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT)).toBe(first);
  });

  it("gives two claims at once the same fingerprint", async () => {
    const claims = await Promise.all(
      [1, 2, 3].map((fill) =>
        claimMasterKeyFingerprint(masterKeyFingerprint(Buffer.alloc(32, fill)))
      )
    );

    expect(new Set(claims).size).toBe(1);
    expect(await getConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT)).toBe(claims[0]);
  });
});
