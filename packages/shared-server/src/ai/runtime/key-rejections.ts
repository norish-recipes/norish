/**
 * Which configured API keys the provider is refusing (401/403), so an
 * administrator hears about it. A feature with a fallback swallows the
 * failure — ingredient matching mints a flagged food and carries on — and a
 * key revoked after it was saved is never tested again, so without this a
 * dead key only shows as AI quietly doing worse.
 *
 * A block counts as refused from the first refusal until a request with its
 * settings answers, or the block is saved again.
 *
 * ponytail: process memory, as the queue workers run in the web server's
 * process; a restart forgets until the next refused request. Persist it if the
 * workers ever move out of process.
 */

import type { ServerConfigKey } from "@norish/config/zod/server-config";

import { isCredentialRejection } from "./errors";

/** The admin settings block whose key a request used. */
export type KeyBlock = Extract<
  ServerConfigKey,
  "ai_config" | "video_config" | "image_generation_config" | "decision_config"
>;

export interface KeyRejection {
  block: KeyBlock;
  /** When the provider first refused the key, as an ISO timestamp. */
  since: string;
}

const STORE_KEY = Symbol.for("norish:ai-key-rejections");

const g = globalThis as { [STORE_KEY]?: Map<KeyBlock, string> };
const rejectedSince: Map<KeyBlock, string> = g[STORE_KEY] ?? (g[STORE_KEY] = new Map());

/** Remember `block`'s key as refused, when `error` is the provider refusing it. */
export function noteKeyRejection(block: KeyBlock, error: unknown): void {
  if (isCredentialRejection(error) && !rejectedSince.has(block)) {
    rejectedSince.set(block, new Date().toISOString());
  }
}

/** `block`'s key answered, or was replaced: it is no longer refused. */
export function forgetKeyRejection(block: KeyBlock): void {
  rejectedSince.delete(block);
}

export function listKeyRejections(): KeyRejection[] {
  return [...rejectedSince].map(([block, since]) => ({ block, since }));
}
