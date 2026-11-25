// @vitest-environment node
import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authSecret,
  encrypt,
  hmacIndex,
  initMasterKey,
  masterKeyFingerprint,
} from "@norish/config/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { forgetMasterKey } from "../../config/__tests__/helpers/master-key";

const config = vi.hoisted(() => ({
  UPLOADS_DIR: "",
  MASTER_KEY: undefined as string | undefined,
  MASTER_KEY_PREVIOUS: undefined as string | undefined,
}));
// The database as boot sees it: the stored fingerprint, and what the instance's key wrote last.
const database = vi.hoisted(() => ({
  fingerprint: null as string | null,
  written: null as string | null,
}));
const setConfig = vi.hoisted(() => vi.fn());
const logged = vi.hoisted(() => [] as unknown[]);

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));
vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: async (key: string) =>
    key === ServerConfigKeys.MASTER_KEY_FINGERPRINT ? database.fingerprint : null,
  setConfig,
}));
vi.mock("@norish/db/repositories/master-key", () => ({
  findNewestEncryptedValue: async () => database.written,
}));
vi.mock("@norish/shared-server/logger", () => {
  const record = (...args: unknown[]) => void logged.push(args);
  const logger = { debug: record, info: record, warn: record, error: record };

  return { serverLogger: logger, createLogger: () => logger };
});

const { keyFilePath, readKeyFile, resolveMasterKey, writeKeyFile } =
  await import("@norish/shared-server/master-key");

const keyDir = () => path.dirname(keyFilePath());
const modeOf = async (target: string) => (await fs.stat(target)).mode & 0o777;

/** What `key` encrypts `plain` to, with no key left open after. */
function sealedBy(key: Buffer, plain: string): string {
  initMasterKey(key);
  const sealed = encrypt(plain);

  forgetMasterKey();

  return sealed;
}

/** The HMAC key `key` yields, as an email lookup shows it: whether boot opened that key. */
function lookupBy(key: Buffer): string {
  initMasterKey(key);
  const lookup = hmacIndex("ada@example.com");

  forgetMasterKey();

  return lookup;
}

beforeEach(() => {
  config.UPLOADS_DIR = path.join(
    mkdtempSync(path.join(os.tmpdir(), "master-key-test-")),
    "uploads"
  );
  config.MASTER_KEY = undefined;
  config.MASTER_KEY_PREVIOUS = undefined;
  database.fingerprint = null;
  database.written = null;
  setConfig.mockReset();
  logged.length = 0;
  forgetMasterKey();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the key file", () => {
  it("lives under the uploads, readable by this user only, in a folder no one else can list", async () => {
    const current = randomBytes(32);

    await writeKeyFile({ current });

    expect(keyFilePath()).toBe(path.join(config.UPLOADS_DIR, ".norish", "master-key.json"));
    expect(await modeOf(keyFilePath())).toBe(0o600);
    expect(await modeOf(keyDir())).toBe(0o700);
    expect(await readKeyFile()).toEqual({ current });
  });

  it("keeps a previous key beside the current one", async () => {
    const keys = { current: randomBytes(32), previous: randomBytes(32) };

    await writeKeyFile(keys);

    expect(await readKeyFile()).toEqual(keys);
  });

  it("closes a folder someone opened up", async () => {
    await fs.mkdir(keyDir(), { recursive: true, mode: 0o755 });
    await fs.chmod(keyDir(), 0o755);

    await writeKeyFile({ current: randomBytes(32) });

    expect(await modeOf(keyDir())).toBe(0o700);
  });

  it("is none when there is no file", async () => {
    expect(await readKeyFile()).toBeNull();
  });

  it("refuses a file that is not a key file without repeating what it holds", async () => {
    await fs.mkdir(keyDir(), { recursive: true });
    await fs.writeFile(keyFilePath(), '{"current":"sekrit-not-a-key"}');

    const refusal = readKeyFile();

    await expect(refusal).rejects.toThrow(`${keyFilePath()} is not a Norish key file`);
    await expect(refusal).rejects.not.toThrow(/sekrit/);
  });

  it("leaves the old file whole, and no half-written one, when a write fails", async () => {
    const old = { current: randomBytes(32) };

    await writeKeyFile(old);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk gone"));

    await expect(writeKeyFile({ current: randomBytes(32) })).rejects.toThrow("disk gone");

    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });
});

describe("which key boot opens", () => {
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);
  const fingerprintWritten = () =>
    setConfig.mock.calls.find(([key]) => key === ServerConfigKeys.MASTER_KEY_FINGERPRINT)?.[1];
  const opened = () => hmacIndex("ada@example.com");
  const RESTORE = "The only way back is restoring MASTER_KEY";

  afterEach(() => {
    // Nothing boot says names a key, the current or any other.
    const said = JSON.stringify(logged);

    for (const key of [keyA, keyB]) expect(said).not.toContain(key.toString("base64"));
  });

  describe("with no fingerprint in the database", () => {
    it("adopts MASTER_KEY over the data it wrote, as every instance from before does", async () => {
      config.MASTER_KEY = keyA.toString("base64");
      database.written = sealedBy(keyA, "ada@example.com");

      await resolveMasterKey();

      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
      expect(opened()).toBe(lookupBy(keyA));
      expect(await readKeyFile()).toBeNull();
    });

    it("adopts MASTER_KEY on an empty instance", async () => {
      config.MASTER_KEY = keyA.toString("base64");

      await resolveMasterKey();

      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
      expect(opened()).toBe(lookupBy(keyA));
    });

    it("refuses a MASTER_KEY that does not open the data, and writes no fingerprint for it", async () => {
      config.MASTER_KEY = keyB.toString("base64");
      database.written = sealedBy(keyA, "ada@example.com");

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(setConfig).not.toHaveBeenCalled();
      expect(opened).toThrow("used before boot resolved it");
    });

    it("refuses to re-key yet when only MASTER_KEY_PREVIOUS opens the data", async () => {
      config.MASTER_KEY = keyB.toString("base64");
      config.MASTER_KEY_PREVIOUS = keyA.toString("base64");
      database.written = sealedBy(keyA, "ada@example.com");

      await expect(resolveMasterKey()).rejects.toThrow(
        "This database is encrypted with MASTER_KEY_PREVIOUS"
      );
      expect(setConfig).not.toHaveBeenCalled();
    });

    it("generates a key file on a first boot and opens that key", async () => {
      await resolveMasterKey();

      const generated = (await readKeyFile())?.current;

      expect(generated).toHaveLength(32);
      expect(await modeOf(keyFilePath())).toBe(0o600);
      expect(fingerprintWritten()).toBe(generated && masterKeyFingerprint(generated));
      expect(opened()).toBe(generated && lookupBy(generated));
    });

    it("keeps a key file a first boot wrote before it stopped", async () => {
      await writeKeyFile({ current: keyA });

      await resolveMasterKey();

      expect(await readKeyFile()).toEqual({ current: keyA });
      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
    });

    it("refuses without MASTER_KEY over data an earlier key wrote, generating nothing", async () => {
      database.written = sealedBy(keyA, "ada@example.com");

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not set, and this database holds data an earlier key encrypted."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(await readKeyFile()).toBeNull();
      expect(setConfig).not.toHaveBeenCalled();
    });
  });

  describe("with a fingerprint in the database", () => {
    beforeEach(() => {
      database.fingerprint = masterKeyFingerprint(keyA);
    });

    it("opens a MASTER_KEY that matches, writing nothing", async () => {
      config.MASTER_KEY = keyA.toString("base64");

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(setConfig).not.toHaveBeenCalled();
      expect(await readKeyFile()).toBeNull();
    });

    it("opens the key file's key when it matches", async () => {
      await writeKeyFile({ current: keyA });

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(setConfig).not.toHaveBeenCalled();
    });

    it("ignores the key file in env mode", async () => {
      await writeKeyFile({ current: keyB });
      config.MASTER_KEY = keyA.toString("base64");

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
    });

    it("refuses a mismatched MASTER_KEY", async () => {
      config.MASTER_KEY = keyB.toString("base64");

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(setConfig).not.toHaveBeenCalled();
      expect(opened).toThrow("used before boot resolved it");
    });

    it("refuses when the key file is gone, generating none", async () => {
      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(`The key file ${keyFilePath()} is missing`);
      await expect(boot).rejects.toThrow(RESTORE);
      expect(await readKeyFile()).toBeNull();
    });

    it("refuses a key file whose key does not match", async () => {
      await writeKeyFile({ current: keyB });

      await expect(resolveMasterKey()).rejects.toThrow(
        `The key in ${keyFilePath()} is not the key this database is encrypted with.`
      );
      expect(await readKeyFile()).toEqual({ current: keyB });
    });

    it("refuses to re-key yet when the previous key matches", async () => {
      config.MASTER_KEY = keyB.toString("base64");
      config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

      await expect(resolveMasterKey()).rejects.toThrow(
        "This database is encrypted with MASTER_KEY_PREVIOUS"
      );
      expect(opened).toThrow("used before boot resolved it");
    });

    it("refuses to re-key yet when the key file's previous key matches", async () => {
      await writeKeyFile({ current: keyB, previous: keyA });

      await expect(resolveMasterKey()).rejects.toThrow(
        `This database is encrypted with the previous key in ${keyFilePath()}`
      );
    });
  });

  it("names a key with a label of its own, apart from the keys it yields", () => {
    initMasterKey(keyA);

    expect(masterKeyFingerprint(keyA)).toMatch(/^[0-9a-f]{64}$/);
    expect(masterKeyFingerprint(keyA)).not.toBe(masterKeyFingerprint(keyB));
    expect(masterKeyFingerprint(keyA)).not.toBe(
      Buffer.from(authSecret(), "base64url").toString("hex")
    );
    expect(masterKeyFingerprint(keyA)).not.toBe(keyA.toString("hex"));
  });
});
