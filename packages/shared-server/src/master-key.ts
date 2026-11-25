import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { initMasterKey, masterKeyFingerprint, masterKeyOpens } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { countEncryptedRows, findNewestCiphertext } from "@norish/db/repositories/master-key";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
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

/** Beside the uploads, so one backup of the database and the volume restores everything. */
export function keyFilePath(): string {
  return path.join(SERVER_CONFIG.UPLOADS_DIR, ".norish", "master-key.json");
}

/** The key file, or null when there is none. Its contents never reach an error message. */
export async function readKeyFile(): Promise<KeyFile | null> {
  let text: string;

  try {
    text = await fs.readFile(keyFilePath(), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }

  let stored: z.infer<typeof KeyFileSchema>;

  try {
    stored = KeyFileSchema.parse(JSON.parse(text));
  } catch {
    throw new Error(`${keyFilePath()} is not a Norish key file`);
  }

  return mapKeys(stored, fromBase64);
}

/** Replace the key file in one rename, readable by this user only: a crash leaves old or new, never half. */
export async function writeKeyFile(keys: KeyFile): Promise<void> {
  const file = keyFilePath();
  const dir = path.dirname(file);
  const temp = `${file}.${randomBytes(8).toString("hex")}.tmp`;

  await fs.mkdir(SERVER_CONFIG.UPLOADS_DIR, { recursive: true });
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(dir, 0o700);

  try {
    const handle = await fs.open(temp, "wx", 0o600);

    try {
      await handle.writeFile(JSON.stringify(mapKeys(keys, toBase64)));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, file);
  } catch (error) {
    await fs.rm(temp, { force: true });
    throw error;
  }

  // The rename itself reaches the disk only with its directory.
  const dirHandle = await fs.open(dir, "r");

  try {
    await dirHandle.sync();
  } finally {
    await dirHandle.close();
  }
}

/** Where boot's keys come from: MASTER_KEY pins them, else the key file holds them. */
type KeySource = {
  pinned: boolean;
  keys: KeyFile | null;
  /** How a log or a refusal names the current key, and the previous one. */
  current: string;
  previous: string;
};

async function keySource(): Promise<KeySource> {
  const { MASTER_KEY, MASTER_KEY_PREVIOUS } = SERVER_CONFIG;

  if (MASTER_KEY) {
    return {
      pinned: true,
      keys: mapKeys({ current: MASTER_KEY, previous: MASTER_KEY_PREVIOUS }, fromBase64),
      current: "MASTER_KEY",
      previous: "MASTER_KEY_PREVIOUS",
    };
  }

  return {
    pinned: false,
    keys: await readKeyFile(),
    current: `The key in ${keyFilePath()}`,
    previous: `the previous key in ${keyFilePath()}`,
  };
}

/** Why boot will not start: names the missing key and the way back, and never prints a key. */
function refusal(problem: string): Error {
  return new Error(
    `${problem} The only way back is restoring MASTER_KEY, or the uploads volume that holds ${keyFilePath()}, from a backup.`
  );
}

/** The current key when it `fits` the database, else the refusal naming the key that is wrong. */
function keyThatFits(source: KeySource, fits: (key: Buffer) => boolean): Buffer {
  const { keys } = source;

  if (keys && fits(keys.current)) return keys.current;
  // ponytail: refuses until boot can re-key; ticket 03 re-encrypts here instead.
  if (keys?.previous && fits(keys.previous)) {
    throw new Error(
      `This database is encrypted with ${source.previous}, and re-encrypting it under a new key is not available yet. Put the previous key back as the current one.`
    );
  }
  throw refusal(
    keys
      ? `${source.current} is not the key this database is encrypted with.`
      : `MASTER_KEY is not set, and there is no key file at ${keyFilePath()}. This database is encrypted with a key that one of them held.`
  );
}

async function generateKeyFile(): Promise<Buffer> {
  const key = randomBytes(32);

  await writeKeyFile({ current: key });
  log.info({ source: keyFilePath() }, "Master Key generated");

  return key;
}

/**
 * Pick the Master Key by the database's fingerprint and open it: once, after the database is
 * reachable and before any crypto. Generates one only for an instance that holds nothing encrypted.
 */
export async function resolveMasterKey(): Promise<void> {
  const source = await keySource();
  const fingerprint = await getConfig<string>(ServerConfigKeys.MASTER_KEY_FINGERPRINT);

  if (fingerprint) {
    initMasterKey(keyThatFits(source, (key) => masterKeyFingerprint(key) === fingerprint));
    log.info({ source: source.current }, "Master Key opened");

    return;
  }

  // No fingerprint: an instance from before fingerprints, or one that has never started.
  const encrypted = (await countEncryptedRows()) > 0;

  if (encrypted && !source.pinned) {
    throw refusal("MASTER_KEY is not set, and this database holds data an earlier key encrypted.");
  }

  // A value that does not decrypt, an empty one included, never shows that a key fits.
  const newest = encrypted ? await findNewestCiphertext() : null;
  const key = encrypted
    ? keyThatFits(source, (candidate) => newest !== null && masterKeyOpens(candidate, newest))
    : (source.keys?.current ?? (await generateKeyFile()));

  await setConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT, masterKeyFingerprint(key), null, false);
  log.info({ source: source.current }, "Master Key adopted, fingerprint written");
  initMasterKey(key);
}
