import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  initMasterKey,
  isBase64,
  masterKeyFingerprint,
  masterKeyOpens,
  masterKeyRotation,
} from "@norish/config/crypto";
import { MasterKeySchema, SERVER_CONFIG } from "@norish/config/env-config-server";
import {
  claimMasterKeyFingerprint,
  countEncryptedRows,
  findNewestCiphertext,
  getMasterKeyFingerprint,
  rekeyMasterKey,
} from "@norish/db/repositories/master-key";
import { serverLogger as log } from "@norish/shared-server/logger";

/** Ends every session the session store keeps; the server's boot hands in Better Auth's. */
export type EndStoredSessions = () => Promise<{ sessions: number; verifications: number }>;

/**
 * The keys a key file holds, each as the text it was given, which a rewrite never re-encodes.
 * `previous` only between a rotation and the boot that re-keys.
 */
export type KeyFile = { current: string; previous?: string };

const fromBase64 = (key: string) => Buffer.from(key, "base64");

/** A key as Norish generates one: base64 of 32 random bytes. */
const generatedKey = () => randomBytes(32).toString("base64");

const KeyFileSchema = z.object({
  current: MasterKeySchema,
  previous: MasterKeySchema.optional(),
});

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
    return KeyFileSchema.parse(JSON.parse(text));
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

/** Flush `target`, a file or a folder, to disk. */
async function flush(target: string): Promise<void> {
  const handle = await fs.open(target, "r");

  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Flush a new name in `dir` to disk; a filesystem that cannot flush a folder only warns. */
async function flushFolder(dir: string, mustLand: boolean): Promise<void> {
  try {
    await flush(dir);
  } catch (error) {
    if (mustLand && !FLUSH_UNSUPPORTED.has(errorCode(error))) throw error;
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
  const text = JSON.stringify(keys);

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
  // A crash that undoes a replacement leaves the old file, which still holds the data's key.
  await flushFolder(dir, !replace);
  // A first boot may have made the key folder, whose name the uploads folder holds.
  if (!replace) await flushFolder(SERVER_CONFIG.UPLOADS_DIR, true);
}

/** Flush the key file and its folder, so a power cut after a re-key cannot undo the file. */
async function flushKeyFile(): Promise<void> {
  await flush(keyFilePath());
  await flushFolder(path.dirname(keyFilePath()), true);
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

/** A key as given and as bytes, and how a log or a refusal names it at the start of a sentence. */
type NamedKey = { text: string; bytes: Buffer; label: string };

/** Where boot's keys come from: MASTER_KEY pins them, else the key file holds them. */
type KeySource = { pinned: boolean; keys: { current: NamedKey; previous?: NamedKey } | null };

/** How file mode names the key file's keys. */
const fileLabels = () => ({
  current: `The key in ${keyFilePath()}`,
  previous: `The previous key in ${keyFilePath()}`,
});

const namedKey = (text: string, label: string): NamedKey => ({
  text,
  bytes: fromBase64(text),
  label,
});

/** Each of `keys` beside its label. */
function named(keys: KeyFile, labels: { current: string; previous: string }) {
  return {
    current: namedKey(keys.current, labels.current),
    ...(keys.previous && { previous: namedKey(keys.previous, labels.previous) }),
  };
}

/** The keys MASTER_KEY and MASTER_KEY_PREVIOUS give, or null when MASTER_KEY is unset. */
function pinnedKeys(): KeyFile | null {
  const { MASTER_KEY, MASTER_KEY_PREVIOUS } = SERVER_CONFIG;

  return MASTER_KEY ? { current: MASTER_KEY, previous: MASTER_KEY_PREVIOUS } : null;
}

/** Env mode: MASTER_KEY pins the key and boot ignores the key file. */
export const masterKeyPinned = (): boolean => pinnedKeys() !== null;

async function keySource(): Promise<KeySource> {
  const pinned = pinnedKeys();

  if (pinned) {
    return {
      pinned: true,
      keys: named(pinned, { current: "MASTER_KEY", previous: "MASTER_KEY_PREVIOUS" }),
    };
  }
  const keys = await readKeyFile();

  return { pinned: false, keys: keys && named(keys, fileLabels()) };
}

/** The current or previous key, whichever `fits` the database, or null. */
function findKey(source: KeySource, fits: (key: Buffer) => boolean) {
  const { keys } = source;

  if (keys && fits(keys.current.bytes)) return { keys, key: keys.current };
  if (keys?.previous && fits(keys.previous.bytes)) return { keys, key: keys.previous };

  return null;
}

/** The current or previous key, whichever `fits` the database, else the refusal naming the key. */
function pickKey(source: KeySource, fits: (key: Buffer) => boolean) {
  const found = findKey(source, fits);

  if (found) return found;
  const { keys } = source;

  throw refusal(
    keys
      ? `${keys.current.label} is not the key this database is encrypted with.`
      : `MASTER_KEY is not set, and there is no key file at ${keyFilePath()}. This database is encrypted with a key that one of them held.`
  );
}

/** What the 32 characters MasterKeySchema asks for hold when each one is base64. */
const NEW_KEY_BYTES = 24;

/** Refuse a key the data is not on yet unless it is base64, as base64 skips any other character. */
function checkNewKey(key: NamedKey): void {
  if (isBase64(key.text) && key.bytes.length >= NEW_KEY_BYTES) return;
  throw new Error(
    `${key.label} is not base64, which a new Master Key must be. Make one with \`openssl rand -base64 32\`.`
  );
}

/** A new key file, or the one another first boot wrote at the same time. */
async function generateKeyFile(): Promise<string> {
  const key = generatedKey();

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
  const found = encrypted
    ? pickKey(source, (candidate) => newest !== null && masterKeyOpens(candidate, newest))
    : null;
  const key =
    found?.key ?? source.keys?.current ?? namedKey(await generateKeyFile(), fileLabels().current);
  const keys = source.keys ?? { current: key };

  // Boot ends on the current key, which is new to this instance unless it opened the data.
  if (found?.key !== keys.current) checkNewKey(keys.current);
  // Another first boot may have stored its fingerprint since this one looked; that one stands.
  const stored = await claimMasterKeyFingerprint(masterKeyFingerprint(key.bytes));

  log.info({ source: key.label }, "Master Key adopted");

  return [{ ...source, keys }, stored];
}

const hasFingerprint = (fingerprint: string | null) => (key: Buffer) =>
  masterKeyFingerprint(key) === fingerprint;

/** The key the database's fingerprint names, current or previous, or the refusal naming it. */
const keyWithFingerprint = (source: KeySource, fingerprint: string | null) =>
  pickKey(source, hasFingerprint(fingerprint));

/** What a driver's error may show in a log: its code and the names Postgres failed on. */
const SAFE_FIELDS = ["code", "table", "column", "constraint"] as const;

/**
 * `error` as boot may log it: what failed, with the driver's safe fields only. A message can quote
 * a value, and parameters and arguments hold session tokens, new ciphertext and row ids.
 */
function failed(what: string, error: unknown): Error {
  // Drizzle wraps the driver's error in one whose message carries the statement's parameters.
  const driver = error instanceof Error && error.cause !== undefined ? error.cause : error;
  const known = SAFE_FIELDS.flatMap((field) => {
    const value: unknown = driver instanceof Error ? Reflect.get(driver, field) : undefined;

    return typeof value === "string" && value !== "" ? [`${field} ${value}`] : [];
  });

  return new Error(`${what} failed${known.length > 0 ? ` (${known.join(", ")})` : ""}`);
}

/** Move everything from the previous key to the current one; until it commits nothing serves. */
async function rekey(
  previous: NamedKey,
  current: NamedKey,
  endStoredSessions: EndStoredSessions
): Promise<void> {
  log.info({ from: previous.label, to: current.label }, "Re-keying to a new Master Key");
  // Before the transaction: a crash after this only repeats it on the next boot.
  const valkey = await endStoredSessions().catch((error: unknown) => {
    throw failed("Ending the stored sessions", error);
  });
  const rotation = masterKeyRotation(previous.bytes, current.bytes);
  const { columns, revokedShares, ended } = await rekeyMasterKey(rotation, {
    from: masterKeyFingerprint(previous.bytes),
    to: masterKeyFingerprint(current.bytes),
  }).catch((error: unknown) => {
    throw failed("The re-key", error);
  });

  log.info(
    { columns, ended: { postgres: ended, valkey } },
    "Master Key re-keyed and every session ended"
  );
  for (const [column, { plaintext }] of Object.entries(columns)) {
    if (plaintext > 0) {
      log.warn({ column, count: plaintext }, "Values stored in plain text were encrypted");
    }
  }
  const unreadable = Object.fromEntries(
    Object.entries(columns)
      .filter(([, counts]) => counts.unreadable > 0)
      .map(([column, counts]) => [column, counts.unreadable])
  );

  if (Object.keys(unreadable).length > 0) {
    log.warn(
      { columns: unreadable },
      "Values neither key opens were left as they are: damaged, or encrypted under another key. " +
        "A user whose email is one of them cannot be found by that address, so the address could sign up again. " +
        "A plain-text name, email or image of 38 or more base64 characters is counted here too"
    );
  }
  if (revokedShares > 0) {
    log.warn(
      { count: revokedShares },
      "Share links made before 0.28 kept no token and were revoked; their owners can share again"
    );
  }
}

/** Retire a previous key the database no longer needs: the key file drops it, env mode says so. */
async function retirePrevious(source: KeySource, current: string): Promise<void> {
  if (source.pinned) {
    log.warn("MASTER_KEY_PREVIOUS is no longer needed and can be removed");

    return;
  }
  try {
    await writeKeyFile({ current }, { replace: true });
  } catch (error) {
    // The database is on the current key, so boot starts: the old file and the new both hold it.
    log.error(
      { path: keyFilePath(), code: errorCode(error) },
      "The retired Master Key may still be in the key file; the next boot checks again"
    );

    return;
  }
  log.info({ source: keyFilePath() }, "Previous Master Key removed from the key file");
}

/** Env mode never uses the key file, so one left from file mode may keep a retired key: say so. */
async function warnOfRetiredKeyFile(fingerprint: string): Promise<void> {
  // A file env mode cannot read is not its concern.
  const file = await readKeyFile().catch(() => null);
  const fileSource = file && { pinned: false, keys: named(file, fileLabels()) };

  if (!fileSource || findKey(fileSource, hasFingerprint(fingerprint))) return;
  log.warn({ path: keyFilePath() }, "The key file holds a retired Master Key and can be deleted");
}

/**
 * Pick the Master Key by the database's fingerprint and open it: once, after the database is
 * reachable and before any crypto. Generates one only for an instance that holds nothing encrypted.
 */
export async function resolveMasterKey(endStoredSessions: EndStoredSessions): Promise<void> {
  const fingerprint = await getMasterKeyFingerprint();
  const source = await keySource();

  // No fingerprint: an instance from before fingerprints, or one that has never started.
  const [opening, stored]: [KeySource, string | null] = fingerprint
    ? [source, fingerprint]
    : await adoptKey(source);
  const { keys, key } = keyWithFingerprint(opening, stored);

  if (key !== keys.current) {
    checkNewKey(keys.current);
    if (!opening.pinned) await flushKeyFile();
    await rekey(key, keys.current, endStoredSessions);
  }
  initMasterKey(keys.current.bytes);
  log.info({ source: keys.current.label }, "Master Key opened");
  if (opening.pinned) await warnOfRetiredKeyFile(masterKeyFingerprint(keys.current.bytes));
  if (keys.previous) await retirePrevious(opening, keys.current.text);
  await removeLeftoverCopies();
}

/**
 * File mode's rotation: a new `current` beside the key the fingerprint names, so a rotation still
 * waiting for its boot never drops the one key that opens the data. The next boot re-keys.
 * False, writing nothing, when the key file holds no key the fingerprint names.
 */
export async function rotateKeyFile(): Promise<boolean> {
  const source = await keySource();

  if (source.pinned) throw new Error("MASTER_KEY pins the key, so the key file is not used.");
  const found = findKey(source, hasFingerprint(await getMasterKeyFingerprint()));

  if (!found) return false;
  await writeKeyFile({ current: generatedKey(), previous: found.key.text }, { replace: true });
  log.info({ source: keyFilePath() }, "New Master Key written; the next boot re-keys to it");

  return true;
}

/** Open the key the database's fingerprint names, for a tool or script: never generates nor writes one. */
export async function openMasterKey(): Promise<void> {
  const fingerprint = await getMasterKeyFingerprint();

  if (!fingerprint) {
    throw new Error(
      "This database has no Master Key fingerprint yet. Start the Norish server on it once first."
    );
  }
  const source = await keySource();
  const { key } = keyWithFingerprint(source, fingerprint);

  // Until a server's boot re-keys, the data is still the previous key's.
  initMasterKey(key.bytes);
  log.info({ source: key.label }, "Master Key opened");
}
