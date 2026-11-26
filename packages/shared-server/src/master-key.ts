import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { initMasterKey, masterKeyFingerprint, masterKeyOpens } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  claimMasterKeyFingerprint,
  countEncryptedRows,
  findNewestCiphertext,
  getMasterKeyFingerprint,
} from "@norish/db/repositories/master-key";
import { serverLogger as log } from "@norish/shared-server/logger";

/** The keys a key file holds: `previous` only between a rotation and the boot that re-keys. */
export type KeyFile = { current: Buffer; previous?: Buffer };

const fromBase64 = (key: string) => Buffer.from(key, "base64");
const toBase64 = (key: Buffer) => key.toString("base64");

const StoredKey = z.base64().refine((value) => fromBase64(value).length === 32);
const KeyFileSchema = z.object({ current: StoredKey, previous: StoredKey.optional() });

/** `keys` with each key converted, and `previous` only when there is one. */
function mapKeys<From, To>(keys: { current: From; previous?: From }, convert: (key: From) => To) {
  return {
    current: convert(keys.current),
    ...(keys.previous === undefined ? {} : { previous: convert(keys.previous) }),
  };
}

const errorCode = (error: unknown) =>
  error instanceof Error && "code" in error ? String(error.code) : "unknown";

/** Beside the uploads, so one backup of the database and the volume restores everything. */
export function keyFilePath(): string {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, ".norish", "master-key.json");
}

/** Why boot will not start: names the missing key and the way back, and never prints a key. */
function refusal(problem: string): Error {
  return new Error(
    `${problem} The only way back is restoring MASTER_KEY, or the uploads volume that holds ${keyFilePath()}, from a backup.`
  );
}

/** Narrow `target` to `mode` when it is wider, as a restore can leave it; failing only warns. */
async function tighten(target: string, mode: number): Promise<void> {
  try {
    const was = (await fs.stat(target)).mode & 0o777;

    if ((was & ~mode) === 0) return;
    await fs.chmod(target, mode);
    log.warn({ path: target, was: was.toString(8) }, "Key file permissions were open, tightened");
  } catch (error) {
    log.warn({ path: target, err: error }, "Could not tighten the key file's permissions");
  }
}

/** The key file, or null when there is none. Its contents never reach an error message. */
export async function readKeyFile(): Promise<KeyFile | null> {
  let text: string;

  try {
    text = await fs.readFile(keyFilePath(), "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw refusal(`The key file ${keyFilePath()} cannot be read (${errorCode(error)}).`);
  }

  await tighten(keyFilePath(), 0o600);
  await tighten(path.dirname(keyFilePath()), 0o700);

  try {
    return mapKeys(KeyFileSchema.parse(JSON.parse(text)), fromBase64);
  } catch {
    throw refusal(`${keyFilePath()} is not a Norish key file.`);
  }
}

/** Create `target` readable by this user only, flushed to disk. */
async function createFlushed(target: string, text: string): Promise<void> {
  const handle = await fs.open(target, "wx", 0o600);

  try {
    await handle.writeFile(text);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Whether anything, a dangling link included, is at `target`. */
async function exists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);

    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

/** What a filesystem answers when it cannot flush a folder at all, as opposed to failing to. */
const FLUSH_UNSUPPORTED = new Set(["EINVAL", "ENOTSUP", "EOPNOTSUPP", "EISDIR", "ENOSYS"]);

/** Flush a new name in `dir` to disk; a filesystem that cannot flush a folder only warns. */
async function flushFolder(dir: string): Promise<void> {
  try {
    const handle = await fs.open(dir, "r");

    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!FLUSH_UNSUPPORTED.has(errorCode(error))) throw error;
    log.warn({ path: dir, err: error }, "Could not flush the key file's folder to disk");
  }
}

/**
 * Write the key file readable by this user only, whole or not at all: only a flushed copy is ever
 * moved into place. It never replaces a key file (EEXIST) unless told to.
 */
export async function writeKeyFile(keys: KeyFile, { replace = false } = {}): Promise<void> {
  const file = keyFilePath();
  const dir = path.dirname(file);
  const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;
  const text = JSON.stringify(mapKeys(keys, toBase64));

  await fs.mkdir(SERVER_CONFIG.UPLOADS_DIR, { recursive: true });
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(dir, 0o700);

  try {
    await createFlushed(temp, text);
    if (replace) {
      await fs.rename(temp, file);
    } else {
      // A link fails where a file is already, so of two first boots at once one key lands.
      await fs.link(temp, file).catch(async (error: unknown) => {
        if (errorCode(error) === "EEXIST") throw error;
        // No hard links: rename the copy in when no key file is there. Only a link keeps two first
        // boots at once exclusive; Norish runs one process per database.
        if (await exists(file)) {
          throw Object.assign(new Error(`EEXIST: file already exists, ${file}`), {
            code: "EEXIST",
          });
        }
        await fs.rename(temp, file);
      });
    }
  } finally {
    await fs.rm(temp, { force: true });
  }
  await flushFolder(dir);
}

/** Remove the copies a crash mid-write left beside the key file; failing only warns. */
async function removeLeftoverCopies(): Promise<void> {
  const dir = path.dirname(keyFilePath());
  const copy = `${path.basename(keyFilePath())}.`;

  try {
    for (const name of await fs.readdir(dir)) {
      if (name.startsWith(copy) && name.endsWith(".tmp")) {
        await fs.rm(path.join(dir, name), { force: true });
      }
    }
  } catch (error) {
    if (errorCode(error) === "ENOENT") return;
    log.warn({ path: dir, err: error }, "Could not remove a leftover copy of the key file");
  }
}

/** Where boot's keys come from: MASTER_KEY pins them, else the key file holds them. */
type KeySource = {
  pinned: boolean;
  keys: KeyFile | null;
  /** How a log or a refusal names each key, at the start of a sentence. */
  labels: { current: string; previous: string };
};

async function keySource(): Promise<KeySource> {
  const { MASTER_KEY, MASTER_KEY_PREVIOUS } = SERVER_CONFIG;

  if (MASTER_KEY) {
    return {
      pinned: true,
      keys: mapKeys({ current: MASTER_KEY, previous: MASTER_KEY_PREVIOUS }, fromBase64),
      labels: { current: "MASTER_KEY", previous: "MASTER_KEY_PREVIOUS" },
    };
  }

  return {
    pinned: false,
    keys: await readKeyFile(),
    labels: {
      current: `The key in ${keyFilePath()}`,
      previous: `The previous key in ${keyFilePath()}`,
    },
  };
}

/** The current key when it `fits` the database, else the refusal naming the key that is wrong. */
function keyThatFits(source: KeySource, fits: (key: Buffer) => boolean): Buffer {
  const { keys, labels } = source;

  if (keys && fits(keys.current)) return keys.current;
  // ponytail: refuses until boot can re-key; ticket 03 re-encrypts here instead.
  if (keys?.previous && fits(keys.previous)) {
    throw new Error(
      `${labels.previous} is the key this database is encrypted with, and re-encrypting it under a new key is not available yet. Put the previous key back as the current one.`
    );
  }
  throw refusal(
    keys
      ? `${labels.current} is not the key this database is encrypted with.`
      : `MASTER_KEY is not set, and there is no key file at ${keyFilePath()}. This database is encrypted with a key that one of them held.`
  );
}

/** A new key file, or the one another first boot wrote at the same time. */
async function generateKeyFile(): Promise<Buffer> {
  const key = randomBytes(32);

  try {
    await writeKeyFile({ current: key });
  } catch (error) {
    const theirs = errorCode(error) === "EEXIST" ? await readKeyFile() : null;

    if (!theirs) throw error;

    return theirs.current;
  }
  log.info({ source: keyFilePath() }, "Master Key generated");

  return key;
}

/** Claim a fingerprint for a key: the source holding that key, and the fingerprint stored. */
async function adoptKey(source: KeySource): Promise<[KeySource, string | null]> {
  const encrypted = (await countEncryptedRows()) > 0;

  if (encrypted && !source.pinned) {
    throw refusal("MASTER_KEY is not set, and this database holds data an earlier key encrypted.");
  }

  // A value that does not decrypt, an empty one included, never shows that a key fits.
  const newest = encrypted ? await findNewestCiphertext() : null;
  const key = encrypted
    ? keyThatFits(source, (candidate) => newest !== null && masterKeyOpens(candidate, newest))
    : (source.keys?.current ?? (await generateKeyFile()));
  // Another first boot may have stored its fingerprint since this one looked; that one stands.
  const stored = await claimMasterKeyFingerprint(masterKeyFingerprint(key));

  log.info({ source: source.labels.current }, "Master Key adopted");

  return [{ ...source, keys: source.keys ?? { current: key } }, stored];
}

/** Open the key the database's fingerprint names, or refuse naming the key that is missing. */
function openByFingerprint(source: KeySource, fingerprint: string | null): void {
  initMasterKey(keyThatFits(source, (key) => masterKeyFingerprint(key) === fingerprint));
  log.info({ source: source.labels.current }, "Master Key opened");
}

/**
 * Pick the Master Key by the database's fingerprint and open it: once, after the database is
 * reachable and before any crypto. Generates one only for an instance that holds nothing encrypted.
 */
export async function resolveMasterKey(): Promise<void> {
  const fingerprint = await getMasterKeyFingerprint();
  const source = await keySource();

  // No fingerprint: an instance from before fingerprints, or one that has never started.
  const [opening, stored]: [KeySource, string | null] = fingerprint
    ? [source, fingerprint]
    : await adoptKey(source);

  openByFingerprint(opening, stored);
  await removeLeftoverCopies();
}

/** Open the key a server's boot resolved, for a tool or script: never generates nor writes one. */
export async function openMasterKey(): Promise<void> {
  const fingerprint = await getMasterKeyFingerprint();

  if (!fingerprint) {
    throw new Error(
      "This database has no Master Key fingerprint yet. Start the Norish server on it once first."
    );
  }
  openByFingerprint(await keySource(), fingerprint);
}
