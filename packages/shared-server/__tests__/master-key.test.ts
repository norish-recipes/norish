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

import { forgetMasterKey } from "../../config/__tests__/helpers/master-key";

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

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));
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
  findNewestCiphertext: async () => database.encrypted.at(-1) ?? null,
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
      },
      revokedShares: 4,
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

  it("tightens a file and folder a restore left open, and says so", async () => {
    const keys = { current: randomBytes(32) };

    await writeKeyFile(keys);
    await fs.chmod(keyFilePath(), 0o644);
    await fs.chmod(keyDir(), 0o755);

    expect(await readKeyFile()).toEqual(keys);
    expect(await modeOf(keyFilePath())).toBe(0o600);
    expect(await modeOf(keyDir())).toBe(0o700);
    expect(logged.filter(([level]) => level === "warn")).toHaveLength(2);
  });

  it("still opens the key when it cannot tighten the file, and says so", async () => {
    const keys = { current: randomBytes(32) };

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
    const old = { current: randomBytes(32) };

    await writeKeyFile(old);

    await expect(writeKeyFile({ current: randomBytes(32) })).rejects.toThrow("EEXIST");
    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it("leaves the old file whole, and no half-written one, when a replace fails", async () => {
    const old = { current: randomBytes(32) };

    await writeKeyFile(old);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk gone"));

    await expect(writeKeyFile({ current: randomBytes(32) }, { replace: true })).rejects.toThrow(
      "disk gone"
    );

    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it.each(["EPERM", "ENOTSUP", "EOPNOTSUPP", "ENOSYS"])(
    "places the file whole where a hard link fails with %s, never writing it in place",
    async (code) => {
      const keys = { current: randomBytes(32) };
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
    const old = { current: randomBytes(32) };

    await writeKeyFile(old);
    vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));

    await expect(writeKeyFile({ current: randomBytes(32) })).rejects.toThrow("EEXIST");
    expect(await readKeyFile()).toEqual(old);
    expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
  });

  it("keeps a key file it placed when a flush fails, as another boot may have read it", async () => {
    const keys = { current: randomBytes(32) };

    vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));
    failSyncOf("EIO", keyFilePath(), keyDir());

    await expect(writeKeyFile(keys)).rejects.toThrow("EIO");
    expect(await readKeyFile()).toEqual(keys);
  });

  it.each(["EINVAL", "ENOTSUP", "EOPNOTSUPP", "EISDIR", "ENOSYS"])(
    "places the key file when its folder cannot be flushed (%s), and says so",
    async (code) => {
      const keys = { current: randomBytes(32) };

      failSyncOf(code, keyDir());
      await writeKeyFile(keys);

      expect(await readKeyFile()).toEqual(keys);
      expect(warnings()).toHaveLength(1);
    }
  );

  it("fails when flushing its folder fails for real", async () => {
    failSyncOf("EIO", keyDir());

    await expect(writeKeyFile({ current: randomBytes(32) })).rejects.toThrow("EIO");
  });

  it("replaces a key file when told to", async () => {
    const keys = { current: randomBytes(32), previous: randomBytes(32) };

    await writeKeyFile({ current: randomBytes(32) });
    await writeKeyFile(keys, { replace: true });

    expect(await readKeyFile()).toEqual(keys);
    expect(await modeOf(keyFilePath())).toBe(0o600);
  });
});

describe("which key boot opens", () => {
  const keyA = randomBytes(32);
  const keyB = randomBytes(32);
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
        "MASTER_KEY is not the key this database is encrypted with."
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

    it("generates a key file on a first boot and opens that key", async () => {
      await resolveMasterKey();

      const generated = (await readKeyFile())?.current;

      expect(generated).toHaveLength(32);
      expect(await modeOf(keyFilePath())).toBe(0o600);
      expect(fingerprintWritten()).toBe(generated && masterKeyFingerprint(generated));
      expect(opened()).toBe(generated && lookupBy(generated));
    });

    it("ends two first boots at once on one key, the one the file and the fingerprint hold", async () => {
      await Promise.all([resolveMasterKey(), resolveMasterKey()]);

      const kept = (await readKeyFile())?.current;

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

      const generated = (await readKeyFile())?.current;

      expect(generated).toHaveLength(32);
      expect(fingerprintWritten()).toBe(generated && masterKeyFingerprint(generated));
      expect(opened()).toBe(generated && lookupBy(generated));
    });

    it("adopts the key file another first boot placed meanwhile where hard links fail", async () => {
      vi.spyOn(fs, "link").mockRejectedValue(failure("EPERM"));
      database.meanwhile = () => writeKeyFile({ current: keyA });

      await resolveMasterKey();

      expect(await readKeyFile()).toEqual({ current: keyA });
      expect(fingerprintWritten()).toBe(masterKeyFingerprint(keyA));
      expect(opened()).toBe(lookupBy(keyA));
    });

    it("keeps a key file a first boot wrote before it stopped", async () => {
      await writeKeyFile({ current: keyA });

      await resolveMasterKey();

      expect(await readKeyFile()).toEqual({ current: keyA });
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
      await writeKeyFile({ current: keyA });

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(fingerprintWrites).toEqual([]);
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
      await writeKeyFile({ current: keyB });

      await expect(resolveMasterKey()).rejects.toThrow(
        `The key in ${keyFilePath()} is not the key this database is encrypted with.`
      );
      expect(await readKeyFile()).toEqual({ current: keyB });
    });

    describe("and the previous key matching it", () => {
      const said = () => JSON.stringify(logged);

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

      it("logs how many values in each column no key opens, and what that means", async () => {
        config.MASTER_KEY = keyB.toString("base64");
        config.MASTER_KEY_PREVIOUS = keyA.toString("base64");

        await resolveMasterKey();

        expect(warnings()).toContainEqual([
          "warn",
          { column: "user.image", count: 3 },
          "Values neither key opens were left as they are: damaged, or encrypted under another key",
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

        it("refuses with Valkey's message, never the command's arguments", async () => {
          // How ioredis rejects a command: the command's name and arguments on the error.
          const rejected = Object.assign(new Error("ERR max number of clients reached"), {
            command: { name: "del", args: [SECRET] },
          });
          const error = await masterKey
            .resolveMasterKey(() => Promise.reject(rejected))
            .catch((caught: unknown) => caught);

          expect(error).toBeInstanceOf(Error);
          expect(bootLogFor(error)).toContain(
            "Ending the stored sessions failed: ERR max number of clients reached"
          );
          expect(bootLogFor(error)).not.toContain(SECRET);
          expect(JSON.stringify(logged)).not.toContain(SECRET);
        });

        it("refuses with Postgres's code and message, never the statement's parameters", async () => {
          const deadlock = Object.assign(new Error("deadlock detected"), { code: "40P01" });

          rekeys.failure = new DrizzleQueryError(
            'update "user" set "email" = $1 where "id" = $2',
            [SECRET, "a-row-id"],
            deadlock
          );
          const error = await resolveMasterKey().catch((caught: unknown) => caught);

          expect(bootLogFor(error)).toContain("The re-key failed (40P01): deadlock detected");
          for (const parameter of [SECRET, "a-row-id"]) {
            expect(bootLogFor(error)).not.toContain(parameter);
          }
          expect(JSON.stringify(logged)).not.toContain(SECRET);
        });
      });

      it("opens no key and keeps the key file when the re-key fails, so the next boot retries", async () => {
        await writeKeyFile({ current: keyB, previous: keyA });
        rekeys.failure = new Error("disk gone");

        await expect(resolveMasterKey()).rejects.toThrow("disk gone");
        expect(openedKeys).toEqual([]);
        expect(database.fingerprint).toBe(masterKeyFingerprint(keyA));
        expect(await readKeyFile()).toEqual({ current: keyB, previous: keyA });

        rekeys.failure = null;
        await resolveMasterKey();
        expect(opened()).toBe(lookupBy(keyB));
      });

      it("re-keys from the key file's previous key, then leaves no copy of it", async () => {
        await writeKeyFile({ current: keyB, previous: keyA });

        await resolveMasterKey();

        expect(rekeys.calls).toHaveLength(1);
        expect(opened()).toBe(lookupBy(keyB));
        expect(await readKeyFile()).toEqual({ current: keyB });
        expect(await fs.readdir(keyDir())).toEqual(["master-key.json"]);
        expect(await fs.readFile(keyFilePath(), "utf8")).not.toContain(keyA.toString("base64"));
      });

      it("then starts plainly on the next boot", async () => {
        await writeKeyFile({ current: keyB, previous: keyA });
        await resolveMasterKey();
        rekeys.calls.length = 0;

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(opened()).toBe(lookupBy(keyB));
      });
    });

    describe("and a previous key that is retired already", () => {
      it("drops it from a key file a crash left it in after the re-key committed", async () => {
        database.fingerprint = masterKeyFingerprint(keyB);
        await writeKeyFile({ current: keyB, previous: keyA });

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(opened()).toBe(lookupBy(keyB));
        expect(await readKeyFile()).toEqual({ current: keyB });
      });

      it("drops one that equals the current key", async () => {
        await writeKeyFile({ current: keyA, previous: keyA });

        await resolveMasterKey();

        expect(rekeys.calls).toEqual([]);
        expect(await readKeyFile()).toEqual({ current: keyA });
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
      await writeKeyFile({ current: keyA });
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
      await writeKeyFile({ current: keyA });
      await fs.writeFile(leftover(), JSON.stringify({ current: keyB.toString("base64") }));
      vi.spyOn(fs, "rm").mockRejectedValue(failure("EACCES"));

      await resolveMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(warnings()).toHaveLength(1);
    });

    it("refuses when neither the key file's key nor its previous one matches", async () => {
      await writeKeyFile({ current: keyB, previous: randomBytes(32) });

      await expect(resolveMasterKey()).rejects.toThrow(
        `The key in ${keyFilePath()} is not the key this database is encrypted with.`
      );
      expect(rekeys.calls).toEqual([]);
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
      await writeKeyFile({ current: keyA });

      await openMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(fingerprintWrites).toEqual([]);
    });

    it("opens the previous key while a re-key is pending, as the data is still under it", async () => {
      database.fingerprint = masterKeyFingerprint(keyA);
      await writeKeyFile({ current: keyB, previous: keyA });

      await openMasterKey();

      expect(opened()).toBe(lookupBy(keyA));
      expect(rekeys.calls).toEqual([]);
      expect(await readKeyFile()).toEqual({ current: keyB, previous: keyA });
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
