import { randomUUID } from "node:crypto";
import type Valkey from "ioredis";

/** A random token a change replaces, so a value stamped with an earlier one never matches again. */
export const freshToken = randomUUID;

/** The key's token; a reader that finds none creates one, so nothing stamped before a loss matches. */
export async function currentToken(valkey: Valkey, key: string): Promise<string> {
  const fresh = freshToken();

  return (await valkey.set(key, fresh, "NX", "GET")) ?? fresh;
}
