import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { initMasterKey, masterKeyFingerprint, masterKeyOpens } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { findNewestEncryptedValue } from "@norish/db/repositories/master-key";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { serverLogger as log } from "@norish/shared-server/logger";

/** The keys a key file holds: `previous` only between a rotation and the boot that re-keys. */
export type KeyFile = { current: Buffer; previous?: Buffer };

const StoredKey = z.base64().refine((value) => Buffer.from(value, "base64").length === 32);
const KeyFileSchema = z.object({ current: StoredKey, previous: StoredKey.optional() });

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

  return {
    current: Buffer.from(stored.current, "base64"),
    ...(stored.previous && { previous: Buffer.from(stored.previous, "base64") }),
  };
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
      await handle.writeFile(
        JSON.stringify({
          current: keys.current.toString("base64"),
          ...(keys.previous && { previous: keys.previous.toString("base64") }),
        })
      );
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

/** Why boot will not start: names the missing key and the way back, and never prints a key. */
function refusal(problem: string): Error {
  return new Error(
    `${problem} The only way back is restoring MASTER_KEY, or the uploads volume that holds ${keyFilePath()}, from a backup.`
  );
}

// ponytail: refuses until boot can re-key; ticket 03 re-encrypts here instead.
function stillOnPreviousKey(envMode: boolean): Error {
  return new Error(
    envMode
      ? "This database is encrypted with MASTER_KEY_PREVIOUS, and re-encrypting it under a new MASTER_KEY is not available yet. Set MASTER_KEY back to the previous key."
      : `This database is encrypted with the previous key in ${keyFilePath()}, and re-encrypting it under the current one is not available yet. Put the previous key back as current.`
  );
}

const fromEnv = (value: string | undefined) => (value ? Buffer.from(value, "base64") : undefined);

/**
 * Pick the Master Key by the database's fingerprint and open it: once, after the database is
 * reachable and before any crypto. Generates one only for an instance that holds nothing encrypted.
 */
export async function resolveMasterKey(): Promise<void> {
  const envMode = SERVER_CONFIG.MASTER_KEY !== undefined;
  const file = envMode ? null : await readKeyFile();
  const current = envMode ? fromEnv(SERVER_CONFIG.MASTER_KEY) : file?.current;
  const previous = envMode ? fromEnv(SERVER_CONFIG.MASTER_KEY_PREVIOUS) : file?.previous;
  const source = envMode ? "MASTER_KEY" : keyFilePath();
  const fingerprint = await getConfig<string>(ServerConfigKeys.MASTER_KEY_FINGERPRINT);

  if (fingerprint) {
    if (current && masterKeyFingerprint(current) === fingerprint) {
      log.info({ source }, "Master Key opened");

      return initMasterKey(current);
    }
    if (previous && masterKeyFingerprint(previous) === fingerprint) {
      throw stillOnPreviousKey(envMode);
    }
    throw refusal(
      !current
        ? `The key file ${keyFilePath()} is missing, and this database is encrypted with the key it held.`
        : `${envMode ? "MASTER_KEY" : `The key in ${keyFilePath()}`} is not the key this database is encrypted with.`
    );
  }

  // No fingerprint: an instance from before fingerprints, or one that has never started.
  const written = await findNewestEncryptedValue();
  let key = current;

  if (envMode && key && written && !masterKeyOpens(key, written)) {
    if (previous && masterKeyOpens(previous, written)) throw stillOnPreviousKey(true);
    throw refusal("MASTER_KEY is not the key this database is encrypted with.");
  }
  if (!envMode && written) {
    throw refusal("MASTER_KEY is not set, and this database holds data an earlier key encrypted.");
  }
  if (!key) {
    key = randomBytes(32);
    await writeKeyFile({ current: key });
    log.info({ source }, "Master Key generated");
  }

  await setConfig(ServerConfigKeys.MASTER_KEY_FINGERPRINT, masterKeyFingerprint(key), null, false);
  log.info({ source }, "Master Key adopted, fingerprint written");
  initMasterKey(key);
}
