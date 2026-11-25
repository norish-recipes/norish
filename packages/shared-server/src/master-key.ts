import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { initMasterKey } from "@norish/config/crypto";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

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

/** Pick the Master Key and open it: once, after the database is reachable and before any crypto. */
export async function resolveMasterKey(): Promise<void> {
  initMasterKey(Buffer.from(SERVER_CONFIG.MASTER_KEY, "base64"));
}
