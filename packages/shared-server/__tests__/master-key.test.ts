// @vitest-environment node
import { randomBytes } from "node:crypto";
import { globSync, mkdtempSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DrizzleQueryError } from "drizzle-orm";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MasterKeyRotation } from "@norish/config/crypto";
import {
  authSecret,
  decrypt,
  encrypt,
  hmacIndex,
  initMasterKey,
  masterKeyFingerprint,
} from "@norish/config/crypto";
import { forgetMasterKey } from "@norish/config/testing";

const config = vi.hoisted(() => ({
  UPLOADS_DIR: "",
  MASTER_KEY: undefined as string | undefined,
  MASTER_KEY_PREVIOUS: undefined as string | undefined,
}));
// The database as boot sees it: its fingerprint, each encrypted row's value (newest last), and
// what another boot does meanwhile, while this one counts rows.
const database = vi.hoisted(() => ({
  fingerprint: null as string | null,
  encrypted: [] as string[],
  meanwhile: async () => {},
}));
// Every fingerprint boot stored, and every key it opened, in order.
const fingerprintWrites = vi.hoisted(() => [] as string[]);
const openedKeys = vi.hoisted(() => [] as Buffer[]);
const logged = vi.hoisted(() => [] as unknown[][]);
// What a re-key did, in order, and how the next one ends: committing, or failing with an error.
const rekeys = vi.hoisted(() => ({
  steps: [] as string[],
  calls: [] as { rotation: MasterKeyRotation; fingerprints: { from: string; to: string } }[],
  failure: null as Error | null,
}));

vi.mock("@norish/config/crypto", async (importOriginal) => {
  const crypto = await importOriginal<typeof import("@norish/config/crypto")>();

  return {
    ...crypto,
    initMasterKey: (key: Buffer) => {
      openedKeys.push(key);
      crypto.initMasterKey(key);
    },
  };
});

vi.mock("@norish/config/env-config-server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/config/env-config-server")>()),
  SERVER_CONFIG: config,
}));
vi.mock("@norish/db/repositories/master-key", () => ({
  // A claim fills a missing fingerprint and keeps one already there.
  claimMasterKeyFingerprint: async (fingerprint: string) => {
    fingerprintWrites.push(fingerprint);
    database.fingerprint ??= fingerprint;

    return database.fingerprint;
  },
  getMasterKeyFingerprint: async () => database.fingerprint,
  countEncryptedRows: async () => {
    await database.meanwhile();

    return database.encrypted.length;
  },
  // As the repository reads it: the newest value that is not empty.
  findNewestCiphertext: async () => database.encrypted.findLast((value) => value !== "") ?? null,
  // A transaction: it moves the fingerprint when it commits, and nothing when it fails.
  rekeyMasterKey: async (
    rotation: MasterKeyRotation,
    fingerprints: { from: string; to: string }
  ) => {
    rekeys.steps.push("transaction");
    rekeys.calls.push({ rotation, fingerprints });
    if (rekeys.failure) throw rekeys.failure;
    database.fingerprint = fingerprints.to;

    return {
      columns: {
        "user.email": { previous: 1, current: 0, plaintext: 0, unreadable: 0 },
        "user.name": { previous: 0, current: 0, plaintext: 2, unreadable: 0 },
        "user.image": { previous: 0, current: 0, plaintext: 0, unreadable: 3 },
        "site_auth_tokens.value_enc": { previous: 0, current: 0, plaintext: 0, unreadable: 5 },
      },
      revokedShares: 4,
      ended: { sessions: 2, verifications: 1 },
    };
  },
}));
vi.mock("@norish/shared-server/logger", () => {
  const record =
    (level: string) =>
    (...args: unknown[]) =>
      void logged.push([level, ...args]);
  const logger = {
    debug: record("debug"),
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
  };

  return { serverLogger: logger, createLogger: () => logger };
});

const masterKey = await import("@norish/shared-server/master-key");
const { keyFilePath, openMasterKey, readKeyFile, writeKeyFile } = masterKey;

/** Boot's key resolution, handed a session store that only records it was ended. */
const resolveMasterKey = () =>
  masterKey.resolveMasterKey(async () => {
    rekeys.steps.push("sessions ended");

    return { sessions: 3, verifications: 1 };
  });

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

const failure = (code: string) => Object.assign(new Error(`${code}: refused`), { code });

/** Files open as usual, but a handle on one of `targets` fails to flush to disk with `code`. */
function failSyncOf(code: string, ...targets: string[]) {
  const open = fs.open;

  vi.spyOn(fs, "open").mockImplementation(async (...args) => {
    const handle = await open(...args);

    if (targets.includes(String(args[0]))) {
      vi.spyOn(handle, "sync").mockRejectedValue(failure(code));
    }

    return handle;
  });
}

const warnings = () => logged.filter(([level]) => level === "warn");

/** A key's text as a generated one is written: base64 of 32 random bytes. */
const newKey = () => randomBytes(32).toString("base64");
const bytesOf = (text: string | undefined) => text && Buffer.from(text, "base64");

beforeEach(() => {
  config.UPLOADS_DIR = path.join(
    mkdtempSync(path.join(os.tmpdir(), "master-key-test-")),
    "uploads"
  );
  config.MASTER_KEY = undefined;
  config.MASTER_KEY_PREVIOUS = undefined;
  database.fingerprint = null;
  database.encrypted = [];
  database.meanwhile = async () => {};
  fingerprintWrites.length = 0;
  openedKeys.length = 0;
  logged.length = 0;
  rekeys.steps.length = 0;
  rekeys.calls.length = 0;
  rekeys.failure = null;
  forgetMasterKey();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the key file", () => {
  it("lives under the uploads, readable by this user only, in a folder no one else can list", async () => {
    const current = newKey();

    await writeKeyFile({ current });

    expect(keyFilePath()).toBe(path.join(config.UPLOADS_DIR, ".norish", "master-key.json"));
    expect(await modeOf(keyFilePath())).toBe(0o600);
    expect(await modeOf(keyDir())).toBe(0o700);
    expect(await readKeyFile()).toEqual({ current });
  });

  it("keeps a previous key beside the current one", async () => {
    const keys = { current: newKey(), previous: newKey() };

    await writeKeyFile(keys);

    expect(await readKeyFile()).toEqual(keys);
  });

  it("closes a folder someone opened up", async () => {
    await fs.mkdir(keyDir(), { recursive: true, mode: 0o755 });
    await fs.chmod(keyDir(), 0o755);

    await writeKeyFile({ current: newKey() });

    expect(await modeOf(keyDir())).toBe(0o700);
  });

  it("tightens a file and folder a restore left open, and says so", async () => {
    const keys = { current: newKey() };

    await writeKeyFile(keys);
    await fs.chmod(keyFilePath(), 0o644);
    await fs.chmod(keyDir(), 0o755);

    expect(await readKeyFile()).toEqual(keys);
    expect(await modeOf(keyFilePath())).toBe(0o600);
    expect(await modeOf(keyDir())).toBe(0o700);
    expect(logged.filter(([level]) => level === "warn")).toHaveLength(2);
  });

  it("still opens the key when it cannot tighten the file, and says so", async () => {
    const keys = { current: newKey() };

    await writeKeyFile(keys);
    await fs.chmod(keyFilePath(), 0o644);
    vi.spyOn(fs, "chmod").mockRejectedValue(new Error("read-only volume"));

    expect(await readKeyFile()).toEqual(keys);
    expect(logged.filter(([level]) => level === "warn")).toHaveLength(1);
  });

  it("is none when there is no file", async () => {
    expect(await readKeyFile()).toBeNull();
  });

  it.each([
    ["a key that is not one", '{"current":"sekrit-not-a-key"}'],
    ["no JSON at all", "sekrit, not even JSON"],
  ])("refuses a file holding %s, the way back named and its contents not", async (_, text) => {
    await fs.mkdir(keyDir(), { recursive: true });
    await fs.writeFile(keyFilePath(), text);

    const refusal = readKeyFile();

    await expect(refusal).rejects.toThrow(`${keyFilePath()} is not a Norish key file.`);
    await expect(refusal).rejects.toThrow("The only way back is restoring MASTER_KEY");
    await expect(refusal).rejects.not.toThrow(/sekrit/);
  });

  it("refuses a key file it cannot read, naming the way back", async () => {
    await fs.mkdir(keyFilePath(), { recursive: true });

    const refusal = readKeyFile();

    await expect(refusal).rejects.toThrow(`The key file ${keyFilePath()} cannot be read (EISDIR).`);
    await expect(refusal).rejects.toThrow("The only way back is restoring MASTER_KEY");
  });

  it("never replaces a key file unless told to", async () => {
    const old = { current: newKey() };

    await writeKeyFile(old);

    await expect(writeKeyFile({ current: newKey() })).rejects.toThrow("EEXIST");
    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it("leaves the old file whole, and no half-written one, when a replace fails", async () => {
    const old = { current: newKey() };

    await writeKeyFile(old);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk gone"));

    await expect(writeKeyFile({ current: newKey() }, { replace: true })).rejects.toThrow(
      "disk gone"
    );

    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it.each(["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS"])(
    "places the file whole where a hard link fails with %s, never writing it in place",
    async (code) => {
      const keys = { current: newKey() };
      const open = vi.spyOn(fs, "open");

      vi.spyOn(fs, "link").mockRejectedValue(failure(code));
      await writeKeyFile(keys);

      expect(open.mock.calls.map(([target]) => target)).not.toContain(keyFilePath());
      expect(await readKeyFile()).toEqual(keys);
      expect(await modeOf(keyFilePath())).toBe(0o600);
      expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
    }
  );

  it("never replaces a key file where hard links fail", async () => {
    const old = { current: newKey() };

    await writeKeyFile(old);
    vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));

    await expect(writeKeyFile({ current: newKey() })).rejects.toThrow("EEXIST");
    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it("keeps a key file it placed when a flush fails, as another boot may have read it", async () => {
    const keys = { current: newKey() };

    vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));
    failSyncOf("EIO", keyFilePath(), keyDir());

    await expect(writeKeyFile(keys)).rejects.toThrow("EIO");
    expect(await readKeyFile()).toEqual(keys);
  });

  it.each(["EINVAL", "ENOTSUP", "EOPNOTSUPP", "EISDIR", "ENOSYS"])(
    "places the key file when its folder cannot be flushed (%s), and says so",
    async (code) => {
      const keys = { current: newKey() };

      failSyncOf(code, keyDir());
      await writeKeyFile(keys);

      expect(await readKeyFile()).toEqual(keys);
      expect(warnings()).toHaveLength(1);
    }
  );

  it("fails when flushing its folder fails for real", async () => {
    failSyncOf("EIO", keyDir());

    await expect(writeKeyFile({ current: newKey() })).rejects.toThrow("EIO");
  });

  it("flushes the uploads folder too, which holds the new key folder's name", async () => {
    failSyncOf("EIO", config.UPLOADS_DIR);

    await expect(writeKeyFile({ current: newKey() })).rejects.toThrow("EIO");
  });

  it("places the key file when the uploads folder cannot be flushed at all, and says so", async () => {
    const keys = { current: newKey() };

    failSyncOf("ENOTSUP", config.UPLOADS_DIR);
    await writeKeyFile(keys);

    expect(await readKeyFile()).toEqual(keys);
    expect(warnings()).toHaveLength(1);
  });

  it("replaces a key file when told to", async () => {
    const keys = { current: newKey(), previous: newKey() };

    await writeKeyFile({ current: newKey() });
    await writeKeyFile(keys, { replace: true });

    expect(await readKeyFile()).toEqual(keys);
    expect(await modeOf(keyFilePath())).toBe(0o600);
  });

  it("writes a key back as the text it was given when a rewrite keeps it as previous", async () => {
    // A key's bytes skip what is not base64, so their base64 can fall under 32 characters.
    const given = "an older key, kept as it was given!!";
    const current = newKey();

    await fs.mkdir(keyDir(), { recursive: true });
    await fs.writeFile(keyFilePath(), JSON.stringify({ current: given }));
    const old = await readKeyFile();

    await writeKeyFile({ current, previous: old?.current }, { replace: true });

    expect(JSON.parse(await fs.readFile(keyFilePath(), "utf8"))).toEqual({
      current,
      previous: given,
    });
    expect(await readKeyFile()).toEqual({ current, previous: given });
  });
});

describe("which key boot opens", () => {
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);
  const textA = keyA.toString("base64");
  const textB = keyB.toString("base64");
  const fingerprintWritten = () => fingerprintWrites[0];
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
      database.encrypted = [sealedBy(keyA, "ada@example.com")];

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
      database.encrypted = [sealedBy(keyA, "ada@example.com")];

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with. A key this instance ran under before belongs in MASTER_KEY_PREVIOUS, beside the current one in MASTER_KEY."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(fingerprintWrites).toEqual([]);
      expect(opened).toThrow("used before boot resolved it");
    });

    it("claims MASTER_KEY_PREVIOUS when only it opens the data, then re-keys to MASTER_KEY", async () => {
      config.MASTER_KEY = keyB.toString("base64");
      config.MASTER_KEY_PREVIOUS = keyA.toString("base64");
      database.encrypted = [sealedBy(keyA, "ada@example.com")];

      await resolveMasterKey();

      expect(fingerprintWrites).toEqual([masterKeyFingerprint(keyA)]);
      expect(rekeys.calls.map(({ fingerprints }) => fingerprints)).toEqual([
        { from: masterKeyFingerprint(keyA), to: masterKeyFingerprint(keyB) },
      ]);
      expect(opened()).toBe(lookupBy(keyB));
    });

    it("re-keys from a MASTER_KEY of 24 bytes moved into a key file as its previous key", async () => {
      // 32 characters of base64, as an instance may run on; a generated key is 32 bytes.
      const short = randomBytes(24).toString("base64");
      const generated = randomBytes(32);

      config.MASTER_KEY = short;
      await resolveMasterKey();
      // Written under the key MASTER_KEY opened, however boot turned its text into one.
      database.encrypted = [encrypt("ada@example.com")];
      config.MASTER_KEY = undefined;
      await fs.mkdir(keyDir(), { recursive: true });
      await fs.writeFile(
        keyFilePath(),
        JSON.stringify({ current: generated.toString("base64"), previous: short })
      );

      await resolveMasterKey();

      expect(rekeys.calls.map(({ fingerprints }) => fingerprints)).toEqual([
        { from: fingerprintWritten(), to: masterKeyFingerprint(generated) },
      ]);
      const moved = rekeys.calls[0]?.rotation.reseal(database.encrypted[0] ?? "");

      expect(moved?.was).toBe("previous");
      expect(moved?.sealed && decrypt(moved.sealed)).toBe("ada@example.com");
      expect(opened()).toBe(lookupBy(generated));
      expect(await readKeyFile()).toEqual({ current: generated.toString("base64") });
    });

    it("generates a key file on a first boot and opens that key", async () => {
      await resolveMasterKey();

      const generated = bytesOf((await readKeyFile())?.current);

      expect(generated).toHaveLength(32);
      expect(await modeOf(keyFilePath())).toBe(0o600);
      expect(fingerprintWritten()).toBe(generated && masterKeyFingerprint(generated));
      expect(opened()).toBe(generated && lookupBy(generated));
    });

    it("claims no fingerprint on a first boot whose uploads folder fails to flush to disk", async () => {
      failSyncOf("EIO", config.UPLOADS_DIR);

      await expect(resolveMasterKey()).rejects.toThrow("EIO");
      expect(fingerprintWrites).toEqual([]);
      expect(openedKeys).toEqual([]);
    });

    it("ends two first boots at once on one key, the one the file and the fingerprint hold", async () => {
      await Promise.all([resolveMasterKey(), resolveMasterKey()]);

      const kept = bytesOf((await readKeyFile())?.current);

      expect(kept).toHaveLength(32);
      expect(database.fingerprint).toBe(kept && masterKeyFingerprint(kept));
      expect(openedKeys).toEqual([kept, kept]);
    });

    it("refuses its own key when another boot stored a fingerprint since it looked", async () => {
      config.MASTER_KEY = keyB.toString("base64");
      database.meanwhile = async () => {
        database.fingerprint = masterKeyFingerprint(keyA);
      };

      await expect(resolveMasterKey()).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
      expect(database.fingerprint).toBe(masterKeyFingerprint(keyA));
      expect(openedKeys).toEqual([]);
    });

    it("generates a key file where hard links fail", async () => {
      vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));

      await resolveMasterKey();

      const generated = bytesOf((await readKeyFile())?.current);

      expect(generated).toHaveLength(32);
      expect(fingerprintWritten()).toBe(generated && masterKeyFingerprint(generated));
      expect(opened()).toBe(generated && lookupBy(generated));
    });

    it("adopts the key file another first boot placed meanwhile where hard links fail", async () => {
      vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));
      database.meanwhile = () => writeKeyFile({ current: textA });

      await resolveMasterKey();

      expect(await readKeyFile()).toEqual({ current: textA });
      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
      expect(opened()).toBe(lookupBy(keyA));
    });

    it("keeps a key file a first boot wrote before it stopped", async () => {
      await writeKeyFile({ current: textA });

      await resolveMasterKey();

      expect(await readKeyFile()).toEqual({ current: textA });
      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
    });

    it.each([
      ["an account whose stored email is empty", ""],
      ["a value that is not ciphertext", "bm90IGNpcGhlcnRleHQ="],
    ])("refuses a MASTER_KEY over %s, which it cannot be shown to open", async (_, value) => {
      config.MASTER_KEY = keyA.toString("base64");
      database.encrypted = [value];

      await expect(resolveMasterKey()).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
      expect(fingerprintWrites).toEqual([]);
    });

    it("refuses without MASTER_KEY over an account whose stored email is empty", async () => {
      database.encrypted = [""];

      await expect(resolveMasterKey()).rejects.toThrow("MASTER_KEY is not set");
      expect(await readKeyFile()).toBeNull();
      expect(fingerprintWrites).toEqual([]);
    });

    it("refuses without MASTER_KEY over data an earlier key wrote, generating nothing", async () => {
      database.encrypted = [sealedBy(keyA, "ada@example.com")];

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not set, and this database holds data an earlier key encrypted."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(await readKeyFile()).toBeNull();
      expect(fingerprintWrites).toEqual([]);
    });
  });

  describe("with a key that is not base64", () => {
    // 32 characters, so the length rule passes, but base64 skips every one: no bytes at all.
    const punctuation = "!@#$%^&*".repeat(4);
    const bytes = Buffer.from(punctuation, "base64");
    const NOT_BASE64 = "is not base64, which a new Master Key must be";

    /** Boot's refusal, which says what a key must be and how to make one, and never the key. */
    async function refusedAs(label: string) {
      const error = await resolveMasterKey().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ message: expect.stringContaining(`${label} ${NOT_BASE64}`) });
      expect(error).toMatchObject({ message: expect.stringContaining("openssl rand -base64 32") });
      expect(String(error)).not.toContain(punctuation);
      expect(fingerprintWrites).toEqual([]);
      expect(rekeys.steps).toEqual([]);
      expect(opened).toThrow("used before boot resolved it");
    }

    it("decodes to nothing", () => {
      expect(bytes).toHaveLength(0);
    });

    it("refuses it as MASTER_KEY on a first boot", async () => {
      config.MASTER_KEY = punctuation;

      await refusedAs("MASTER_KEY");
    });

    it("refuses it as the key file's key on a first boot", async () => {
      await fs.mkdir(keyDir(), { recursive: true });
      await fs.writeFile(keyFilePath(), JSON.stringify({ current: punctuation }));

      await refusedAs(`The key in ${keyFilePath()}`);
      expect(await readKeyFile()).toEqual({ current: punctuation });
    });

    it("refuses to re-key to it as MASTER_KEY", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      config.MASTER_KEY = punctuation;
      config.MASTER_KEY_PREVIOUS = textA;

      await refusedAs("MASTER_KEY");
      expect(database.fingerprint).toBe(masterKeyFingerprint(keyA));
    });

    it("refuses to re-key to it as the key file's key", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      await fs.mkdir(keyDir(), { recursive: true });
      await fs.writeFile(keyFilePath(), JSON.stringify({ current: punctuation, previous: textA }));

      await refusedAs(`The key in ${keyFilePath()}`);
      expect(await readKeyFile()).toEqual({ current: punctuation, previous: textA });
    });

    it("refuses to re-key to it before claiming the previous key on an instance from before", async () => {
      database.encrypted = [sealedBy(keyA, "ada@example.com")];
      config.MASTER_KEY = punctuation;
      config.MASTER_KEY_PREVIOUS = textA;

      await refusedAs("MASTER_KEY");
    });

    it("still opens it where the fingerprint names it already", async () => {
      database.fingerprint = masterKeyFingerprint(bytes);
      config.MASTER_KEY = punctuation;

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(bytes));
    });

    it("still adopts it as MASTER_KEY over the data it wrote on an instance from before", async () => {
      database.encrypted = [sealedBy(bytes, "ada@example.com")];
      config.MASTER_KEY = punctuation;

      await resolveMasterKey();

      expect(fingerprintWritten()).toBe(masterKeyFingerprint(bytes));
      expect(opened()).toBe(lookupBy(bytes));
    });

    it("adopts unpadded base64 as a first key", async () => {
      const unpadded = textA.replace(/=+$/, "");

      config.MASTER_KEY = unpadded;
      await resolveMasterKey();

      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
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
      expect(fingerprintWrites).toEqual([]);
      expect(await readKeyFile()).toBeNull();
      expect(warnings()).toEqual([]);
    });

    it("opens the key file's key when it matches", async () => {
      await writeKeyFile({ current: textA });

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(fingerprintWrites).toEqual([]);
    });

    it("ignores the key file in env mode", async () => {
      await writeKeyFile({ current: textB });
      config.MASTER_KEY = keyA.toString("base64");

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
    });

    describe("and a key file left from before MASTER_KEY pinned the key", () => {
      const RETIRED = "The key file holds a retired Master Key and can be deleted";

      it("says it can be deleted once the move to MASTER_KEY re-keys, and on every boot after", async () => {
        await writeKeyFile({ current: textA });
        config.MASTER_KEY = textB;
        config.MASTER_KEY_PREVIOUS = textA;

        await resolveMasterKey();

        expect(database.fingerprint).toBe(masterKeyFingerprint(keyB));
        expect(warnings()).toContainEqual(["warn", { path: keyFilePath() }, RETIRED]);

        logged.length = 0;
        config.MASTER_KEY_PREVIOUS = undefined;
        await resolveMasterKey();

        expect(warnings()).toEqual([["warn", { path: keyFilePath() }, RETIRED]]);
        expect(await readKeyFile()).toEqual({ current: textA });
      });

      it.each([
        ["its current key", { current: textA }],
        ["its previous key", { current: textB, previous: textA }],
      ])("says nothing when %s is the one MASTER_KEY pins", async (_, keys) => {
        await writeKeyFile(keys);
        config.MASTER_KEY = textA;

        await resolveMasterKey();

        expect(warnings()).toEqual([]);
      });
    });

    it("refuses a mismatched MASTER_KEY", async () => {
      config.MASTER_KEY = keyB.toString("base64");

      const boot = resolveMasterKey();

      await expect(boot).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(fingerprintWrites).toEqual([]);
      expect(opened).toThrow("used before boot resolved it");
    });

    it("refuses with no MASTER_KEY and no key file, naming both, generating none", async () => {
      const boot = resolveMasterKey();

      // The fingerprint does not say which one the instance ran on.
      await expect(boot).rejects.toThrow(
        `MASTER_KEY is not set, and there is no key file at ${keyFilePath()}.`
      );
      await expect(boot).rejects.toThrow(RESTORE);
      expect(await readKeyFile()).toBeNull();
    });

    it("refuses a key file whose key does not match", async () => {
      await writeKeyFile({ current: textB });

      await expect(resolveMasterKey()).rejects.toThrow(
        `The key in ${keyFilePath()} is not the key this database is encrypted with.`
      );
      expect(await readKeyFile()).toEqual({ current: textB });
    });

    describe("and the previous key matching it", () => {
      const said = () => JSON.stringify(logged);
      const UNREADABLE =
        "Values neither key opens were left as they are: damaged, or encrypted under another key. " +
        "A user whose email is one of them cannot be found by that address, so the address could sign up again. " +
        "A plain-text name, email or image of 38 or more base64 characters is counted here too";

      it("ends every session, then re-keys from MASTER_KEY_PREVIOUS to MASTER_KEY", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        expect(rekeys.steps).toEqual(["sessions ended", "transaction"]);
        expect(rekeys.calls.map(({ fingerprints }) => fingerprints)).toEqual([
          { from: masterKeyFingerprint(keyA), to: masterKeyFingerprint(keyB) },
        ]);
        expect(database.fingerprint).toBe(masterKeyFingerprint(keyB));
        expect(opened()).toBe(lookupBy(keyB));
        expect(said()).toContain("MASTER_KEY_PREVIOUS is no longer needed and can be removed");
      });

      it("hands the re-key the two keys, which read the previous key's data into the new key", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        const moved = rekeys.calls[0]?.rotation.reseal(sealedBy(keyA, "ada@example.com"));

        initMasterKey(keyB);
        expect(moved?.sealed && decrypt(moved.sealed)).toBe("ada@example.com");
      });

      it("logs how many values in each column were plain text, and never a value", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        expect(warnings()).toContainEqual([
          "warn",
          { column: "user.name", count: 2 },
          "Values stored in plain text were encrypted",
        ]);
        expect(said()).not.toContain("ada@example.com");
      });

      it("logs in one line how many values in each column no key opens, and what that means", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        const unreadable = warnings().filter(([, , message]) =>
          String(message).startsWith("Values neither key opens")
        );

        expect(unreadable).toEqual([
          ["warn", { columns: { "user.image": 3, "site_auth_tokens.value_enc": 5 } }, UNREADABLE],
        ]);
        expect(
          warnings().filter(([, fields]) => JSON.stringify(fields).includes("user.email"))
        ).toEqual([]);
      });

      it("logs how many share links it revoked for keeping no token", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        expect(warnings()).toContainEqual([
          "warn",
          { count: 4 },
          "Share links made before 0.28 kept no token and were revoked; their owners can share again",
        ]);
      });

      describe("and a step failing", () => {
        const SECRET = "a-session-token-or-new-ciphertext";

        /** What boot writes for `error`: `log.fatal({ err })`, through pino as the server logs. */
        function bootLogFor(error: unknown): string {
          const lines: string[] = [];

          pino({}, { write: (line: string) => void lines.push(line) }).fatal(
            { err: error },
            "Server startup failed"
          );

          return lines.join("");
        }

        beforeEach(() => {
          config.MASTER_KEY = keyB.toString("base64");
          config.MASTER_KEY_PREVIOUS = keyA.toString("base64");
        });

        it("refuses naming the step, never Valkey's message or the command's arguments", async () => {
          // How ioredis rejects a command: the command's name and arguments on the error.
          const rejected = Object.assign(new Error(`ERR no such key ${SECRET}`), {
            command: { name: "del", args: [SECRET] },
          });
          const error = await masterKey
            .resolveMasterKey(() => Promise.reject(rejected))
            .catch((caught: unknown) => caught);

          expect(error).toBeInstanceOf(Error);
          expect(error).toMatchObject({ message: "Ending the stored sessions failed" });
          expect(bootLogFor(error)).not.toContain(SECRET);
          expect(JSON.stringify(logged)).not.toContain(SECRET);
        });

        it("refuses with Postgres's code and names, never its message nor the statement's parameters", async () => {
          // Postgres can quote a value in its message and its detail.
          const violation = Object.assign(
            new Error(`duplicate key value violates unique constraint: "${SECRET}"`),
            {
              code: "23505",
              detail: `Key ("emailHmac")=(${SECRET}) already exists.`,
              table: "user",
              column: "emailHmac",
              constraint: "user_email_hmac_idx",
            }
          );

          rekeys.failure = new DrizzleQueryError(
            'update "user" set "email" = $1 where "id" = $2',
            [SECRET, "a-row-id"],
            violation
          );
          const error = await resolveMasterKey().catch((caught: unknown) => caught);

          expect(error).toMatchObject({
            message:
              "The re-key failed (code 23505, table user, column emailHmac, constraint user_email_hmac_idx)",
          });
          expect(error).not.toHaveProperty("cause");
          for (const parameter of [SECRET, "a-row-id"]) {
            expect(bootLogFor(error)).not.toContain(parameter);
          }
          expect(JSON.stringify(logged)).not.toContain(SECRET);
        });
      });

      it("opens no key and keeps the key file when the re-key fails, so the next boot retries", async () => {
        await writeKeyFile({ current: textB, previous: textA });
        rekeys.failure = new Error("disk gone");

        await expect(resolveMasterKey()).rejects.toThrow("The re-key failed");
        expect(openedKeys).toEqual([]);
        expect(database.fingerprint).toBe(masterKeyFingerprint(keyA));
        expect(await readKeyFile()).toEqual({ current: textB, previous: textA });

        rekeys.failure = null;
        await resolveMasterKey();
        expect(opened()).toBe(lookupBy(keyB));
      });

      it.each([
        ["the key file", keyFilePath],
        ["its folder", keyDir],
      ])(
        "re-keys nothing when %s fails to flush to disk, so the next boot retries",
        async (_, target) => {
          await writeKeyFile({ current: textB, previous: textA });
          failSyncOf("EIO", target());

          await expect(resolveMasterKey()).rejects.toThrow("EIO");
          expect(rekeys.steps).toEqual([]);
          expect(openedKeys).toEqual([]);
          expect(database.fingerprint).toBe(masterKeyFingerprint(keyA));
          expect(await readKeyFile()).toEqual({ current: textB, previous: textA });

          vi.restoreAllMocks();
          await resolveMasterKey();
          expect(opened()).toBe(lookupBy(keyB));
        }
      );

      it("re-keys when the key file's folder cannot be flushed at all, and says so", async () => {
        await writeKeyFile({ current: textB, previous: textA });
        failSyncOf("ENOTSUP", keyDir());

        await resolveMasterKey();

        expect(rekeys.steps).toEqual(["sessions ended", "transaction"]);
        expect(warnings()).toContainEqual([
          "warn",
          { path: keyDir(), err: expect.objectContaining({ code: "ENOTSUP" }) },
          "Could not flush the key file's folder to disk",
        ]);
      });

      it("re-keys from the key file's previous key, then leaves no copy of it", async () => {
        await writeKeyFile({ current: textB, previous: textA });

        await resolveMasterKey();

        expect(rekeys.calls).toHaveLength(1);
        expect(opened()).toBe(lookupBy(keyB));
        expect(await readKeyFile()).toEqual({ current: textB });
        expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
        expect(await fs.readFile(keyFilePath(), "utf8")).not.toContain(keyA.toString("base64"));
      });

      it("keeps a current key's text as it was given, so the next boot starts plainly", async () => {
        // Unpadded, so its bytes written back as base64 would read differently.
        const given = randomBytes(32).toString("base64").replace(/=+$/, "");
        const fingerprint = masterKeyFingerprint(Buffer.from(given, "base64"));

        await fs.mkdir(keyDir(), { recursive: true });
        await fs.writeFile(keyFilePath(), JSON.stringify({ current: given, previous: textA }));
        await resolveMasterKey();

        expect(database.fingerprint).toBe(fingerprint);
        expect(JSON.parse(await fs.readFile(keyFilePath(), "utf8"))).toEqual({ current: given });

        await resolveMasterKey();

        expect(rekeys.calls).toHaveLength(1);
        expect(database.fingerprint).toBe(fingerprint);
        expect(opened()).toBe(lookupBy(Buffer.from(given, "base64")));
        expect(said()).not.toContain(given);
      });

      it("then starts plainly on the next boot", async () => {
        await writeKeyFile({ current: textB, previous: textA });
        await resolveMasterKey();
        rekeys.calls.length = 0;

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(opened()).toBe(lookupBy(keyB));
      });
    });

    describe("and a key file that cannot be rewritten to drop the retired key", () => {
      const RETAINED =
        "The retired Master Key may still be in the key file; the next boot checks again";

      /** The key folder read-only, and its mode as another user's folder's is: not ours to change. */
      async function lockKeyFolder() {
        const chmod = fs.chmod;

        await fs.chmod(keyDir(), 0o500);
        const locked = vi
          .spyOn(fs, "chmod")
          .mockImplementation(async (target, mode) =>
            target === keyDir() ? Promise.reject(failure("EPERM")) : chmod(target, mode)
          );

        return async () => {
          locked.mockRestore();
          await fs.chmod(keyDir(), 0o700);
        };
      }

      const errors = () => logged.filter(([level]) => level === "error");

      it("still starts, says so, and drops it on the first boot that can", async () => {
        database.fingerprint = masterKeyFingerprint(keyB);
        await writeKeyFile({ current: textB, previous: textA });
        const unlock = await lockKeyFolder();

        await resolveMasterKey();

        expect(opened()).toBe(lookupBy(keyB));
        expect(errors()).toEqual([["error", { path: keyFilePath(), code: "EPERM" }, RETAINED]]);
        expect(await readKeyFile()).toEqual({ current: textB, previous: textA });

        await unlock();
        await resolveMasterKey();
        expect(await readKeyFile()).toEqual({ current: textB });
      });

      it("still starts right after the re-key commits, the database on the new key", async () => {
        await writeKeyFile({ current: textB, previous: textA });
        const unlock = await lockKeyFolder();

        await resolveMasterKey();

        expect(rekeys.calls).toHaveLength(1);
        expect(database.fingerprint).toBe(masterKeyFingerprint(keyB));
        expect(opened()).toBe(lookupBy(keyB));
        expect(errors()).toEqual([["error", { path: keyFilePath(), code: "EPERM" }, RETAINED]]);

        await unlock();
        await resolveMasterKey();
        expect(rekeys.calls).toHaveLength(1);
        expect(await readKeyFile()).toEqual({ current: textB });
      });
    });

    describe("and a previous key that is retired already", () => {
      it("drops it from a key file a crash left it in after the re-key committed", async () => {
        database.fingerprint = masterKeyFingerprint(keyB);
        await writeKeyFile({ current: textB, previous: textA });

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(opened()).toBe(lookupBy(keyB));
        expect(await readKeyFile()).toEqual({ current: textB });
      });

      it("drops one that equals the current key", async () => {
        await writeKeyFile({ current: textA, previous: textA });

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(await readKeyFile()).toEqual({ current: textA });
      });

      it("says MASTER_KEY_PREVIOUS can go in env mode", async () => {
        config.MASTER_KEY = keyA.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyB.toString("base64");

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(opened()).toBe(lookupBy(keyA));
        expect(warnings()).toEqual([
          ["warn", "MASTER_KEY_PREVIOUS is no longer needed and can be removed"],
        ]);
      });
    });

    const leftover = () => `${keyFilePath()}.0123456789abcdef.tmp`;

    it("removes the copies a crash mid-write left beside the key file", async () => {
      await writeKeyFile({ current: textA });
      await fs.writeFile(leftover(), JSON.stringify({ current: keyB.toString("base64") }));

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
    });

    it("never opens a leftover copy, and keeps it when boot refuses", async () => {
      await fs.mkdir(keyDir(), { recursive: true });
      await fs.writeFile(leftover(), JSON.stringify({ current: keyA.toString("base64") }));

      await expect(resolveMasterKey()).rejects.toThrow("MASTER_KEY is not set");
      expect(await fs.readdir(keyDir())).toEqual([path.basename(leftover())]);
    });

    it("still starts when it cannot remove a leftover copy, and says so", async () => {
      await writeKeyFile({ current: textA });
      await fs.writeFile(leftover(), JSON.stringify({ current: keyB.toString("base64") }));
      vi.spyOn(fs, "rm").mockRejectedValue(failure("EACCES"));

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(warnings()).toHaveLength(1);
    });

    it("refuses when neither the key file's key nor its previous one matches", async () => {
      await writeKeyFile({ current: textB, previous: newKey() });

      await expect(resolveMasterKey()).rejects.toThrow(
        `The key in ${keyFilePath()} is not the key this database is encrypted with.`
      );
      expect(rekeys.calls).toEqual([]);
    });
  });

  describe("rotating the key file from the Admin action", () => {
    const rotate = () => masterKey.rotateKeyFile();
    /** The key file as it stands, its new `current` read as bytes. */
    const rotated = async () => {
      const keys = await readKeyFile();

      if (!keys) throw new Error("There is no key file");

      return { ...keys, bytes: Buffer.from(keys.current, "base64") };
    };

    beforeEach(() => {
      database.fingerprint = masterKeyFingerprint(keyA);
    });

    it("writes a new key of 32 random bytes and keeps the old one as previous, re-keying nothing", async () => {
      await writeKeyFile({ current: textA });

      await expect(rotate()).resolves.toBe(true);

      const { current, previous, bytes } = await rotated();

      expect(previous).toBe(textA);
      expect(bytes).toHaveLength(32);
      expect(current).not.toBe(textA);
      expect(rekeys.calls).toEqual([]);
      expect(openedKeys).toEqual([]);
      expect(JSON.stringify(logged)).not.toContain(current);
    });

    it("hands the next boot a re-key to the new key, which then retires the old one", async () => {
      await writeKeyFile({ current: textA });
      await rotate();
      const { current, bytes } = await rotated();

      await resolveMasterKey();

      expect(rekeys.calls.map(({ fingerprints }) => fingerprints)).toEqual([
        { from: masterKeyFingerprint(keyA), to: masterKeyFingerprint(bytes) },
      ]);
      expect(await readKeyFile()).toEqual({ current });
    });

    it("keeps the key the data is on when a rotation is still waiting for its boot", async () => {
      await writeKeyFile({ current: textB, previous: textA });

      await rotate();

      const { current, previous } = await rotated();

      expect(previous).toBe(textA);
      expect(current).not.toBe(textB);
    });

    it("keeps the data's key through two rotations before a boot, and the boot re-keys from it", async () => {
      await writeKeyFile({ current: textA });

      await rotate();
      await rotate();
      const { previous, bytes } = await rotated();

      expect(previous).toBe(textA);
      await resolveMasterKey();
      expect(rekeys.calls.map(({ fingerprints }) => fingerprints.from)).toEqual([
        masterKeyFingerprint(keyA),
      ]);
      expect(opened()).toBe(lookupBy(bytes));
    });

    it("moves a current key the data is on to previous, dropping a retired one", async () => {
      database.fingerprint = masterKeyFingerprint(keyB);
      await writeKeyFile({ current: textB, previous: textA });

      await rotate();

      expect((await rotated()).previous).toBe(textB);
    });

    it("keeps a key's text as it was given when it moves to previous", async () => {
      const given = "my own key, typed by hand. 2026: ok!";

      database.fingerprint = masterKeyFingerprint(Buffer.from(given, "base64"));
      await fs.mkdir(keyDir(), { recursive: true });
      await fs.writeFile(keyFilePath(), JSON.stringify({ current: given }));

      await rotate();

      expect((await rotated()).previous).toBe(given);
    });

    it("refuses in env mode, writing no key file", async () => {
      config.MASTER_KEY = textA;

      await expect(rotate()).rejects.toThrow("MASTER_KEY pins the key");
      expect(await readKeyFile()).toBeNull();
    });

    it.each([
      ["no key in the file opens the data", masterKeyFingerprint(randomBytes(32))],
      ["the database has no fingerprint", null],
    ])("leaves the key file as it was when %s", async (_, fingerprint) => {
      database.fingerprint = fingerprint;
      await writeKeyFile({ current: textA });

      await expect(rotate()).resolves.toBe(false);
      expect(await readKeyFile()).toEqual({ current: textA });
    });

    it("keeps the new key file and warns when its folder fails to flush after it is in place", async () => {
      await writeKeyFile({ current: textA });
      failSyncOf("EIO", keyDir());

      await rotate();

      const { current, previous } = await rotated();

      expect(previous).toBe(textA);
      expect(current).not.toBe(textA);
      expect(warnings()).toHaveLength(1);
    });

    it("leaves the old key file whole when the new one cannot be put in place", async () => {
      await writeKeyFile({ current: textA });
      vi.spyOn(fs, "rename").mockRejectedValueOnce(failure("ENOSPC"));

      await expect(rotate()).rejects.toThrow("ENOSPC");
      expect(await readKeyFile()).toEqual({ current: textA });
      expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
    });
  });

  describe("for a tool or script", () => {
    it("refuses a database no server has booted on, generating and writing nothing", async () => {
      await expect(openMasterKey()).rejects.toThrow(
        "This database has no Master Key fingerprint yet. Start the Norish server on it once first."
      );
      expect(await readKeyFile()).toBeNull();
      expect(fingerprintWrites).toEqual([]);
      expect(openedKeys).toEqual([]);
    });

    it("opens the key the fingerprint names, writing nothing", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      await writeKeyFile({ current: textA });

      await openMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(fingerprintWrites).toEqual([]);
    });

    it("opens the previous key while a re-key is pending, as the data is still under it", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      await writeKeyFile({ current: textB, previous: textA });

      await openMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(rekeys.calls).toEqual([]);
      expect(await readKeyFile()).toEqual({ current: textB, previous: textA });
    });

    it("refuses a key the fingerprint does not name", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      config.MASTER_KEY = keyB.toString("base64");

      await expect(openMasterKey()).rejects.toThrow(
        "MASTER_KEY is not the key this database is encrypted with."
      );
    });

    it("is how every entry point but the server's boot opens the key", () => {
      const repoRoot = path.resolve(import.meta.dirname, "../../..");
      const sources = globSync(
        ["apps/*/{server,scripts,app,lib}/**/*.{ts,tsx}", "{packages,tooling}/*/src/**/*.ts"],
        { cwd: repoRoot, exclude: (entry) => entry.includes("node_modules") }
      );
      const resolvers = sources.filter((file) =>
        /import\s*{[^}]*\bresolveMasterKey\b[^}]*}\s*from/.test(
          readFileSync(path.join(repoRoot, file), "utf8")
        )
      );

      expect(resolvers).toEqual(["apps/web/server/index.ts"]);
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
