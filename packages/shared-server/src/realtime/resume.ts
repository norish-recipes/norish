/**
 * Resume
 *
 * The bounded buffer behind every non-internal publish (ADR-0034): a
 * per-channel Redis Stream written by the same Lua script that publishes, and
 * an opaque, identity-bound Cursor the client hands back on reconnect.
 *
 * This module owns the bounds, the stream-id arithmetic, the cursor codec and
 * the registration of the `realtimePublish` script on the publisher client.
 * The resume algorithm itself lives beside the tRPC subscription factory.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Redis from "ioredis";
import type { Result } from "ioredis";

import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

import { RealtimeLaggedError } from "./hub";

/** Approximate entries kept per channel stream (`XADD MAXLEN ~`). */
export const RESUME_MAXLEN = 1000;
/** Seconds a channel stream lives after its last write. */
export const RESUME_TTL_SECONDS = 86_400;

/** "Nothing seen on this channel." */
export const ZERO_STREAM_ID = "0-0";

const CURSOR_VERSION = "1";
const IDENTITY_HASH_LENGTH = 8;
const STREAM_ID_PATTERN = /^(\d+)-(\d+)$/;

export interface StreamId {
  ms: number;
  seq: number;
}

export function parseStreamId(id: string): StreamId | null {
  const match = STREAM_ID_PATTERN.exec(id);

  if (!match) return null;

  const ms = Number(match[1]);
  const seq = Number(match[2]);

  if (!Number.isSafeInteger(ms) || !Number.isSafeInteger(seq)) return null;

  return { ms, seq };
}

/**
 * Order two stream ids as `(ms, seq)` tuples. Comparing them as strings would
 * put `999-0` after `1000-0`.
 */
export function compareStreamIds(a: string, b: string): number {
  const left = parseStreamId(a);
  const right = parseStreamId(b);

  if (!left || !right) {
    throw new TypeError(`Not a stream id: ${left ? b : a}`);
  }

  if (left.ms !== right.ms) return left.ms < right.ms ? -1 : 1;
  if (left.seq !== right.seq) return left.seq < right.seq ? -1 : 1;

  return 0;
}

export interface RealtimeIdentity {
  userId: string;
  householdKey: string;
}

/** The first eight hex characters of `sha1(userId + "|" + householdKey)`. */
export function identityHashFor(identity: RealtimeIdentity): string {
  return createHash("sha1")
    .update(`${identity.userId}|${identity.householdKey}`)
    .digest("hex")
    .slice(0, IDENTITY_HASH_LENGTH);
}

export interface RealtimeCursor {
  identityHash: string;
  /** One stream id per channel, in `channelsFor()` order. */
  ids: string[];
}

/** `1.<identityHash>.<id0>,<id1>[,<id2>]` — opaque to the client. */
export function encodeCursor(cursor: RealtimeCursor): string {
  return `${CURSOR_VERSION}.${cursor.identityHash}.${cursor.ids.join(",")}`;
}

/** Decode a cursor; anything malformed is Lagged with `cursor-invalid`. */
export function decodeCursor(raw: string): RealtimeCursor {
  const invalid = () => new RealtimeLaggedError("", "cursor-invalid", 0);

  if (typeof raw !== "string") throw invalid();

  const parts = raw.split(".");

  if (parts.length !== 3 || parts[0] !== CURSOR_VERSION) throw invalid();

  const identityHash = parts[1]!;

  if (!/^[0-9a-f]{8}$/.test(identityHash)) throw invalid();

  const ids = parts[2]!.split(",");

  if (ids.length === 0 || ids.some((id) => !parseStreamId(id))) throw invalid();

  return { identityHash, ids };
}

/** Whether a cursor id's timestamp is older than the buffer keeps. */
export function isStreamIdExpired(id: string, now = Date.now()): boolean {
  const parsed = parseStreamId(id);

  if (!parsed) return true;
  if (parsed.ms === 0) return false;

  return now - parsed.ms > RESUME_TTL_SECONDS * 1_000;
}

export const REALTIME_PUBLISH_COMMAND = "realtimePublish";

let publishScript: string | null = null;

/** The `realtimePublish` Lua script, read once from beside this module. */
export function loadRealtimePublishScript(): string {
  if (publishScript === null) {
    publishScript = readFileSync(
      resolveExistingWorkspacePath(
        join("packages", "shared-server", "src", "realtime", "publish.lua")
      ),
      "utf8"
    );
  }

  return publishScript;
}

declare module "ioredis" {
  interface RedisCommander<Context> {
    realtimePublish(
      streamKey: string,
      channel: string,
      envelope: string,
      maxlen: number,
      ttlSeconds: number
    ): Result<string, Context>;
  }
}

/** Register the script once per client; a second call is a no-op. */
export function registerRealtimePublish(client: Redis): void {
  if (typeof client.realtimePublish === "function") return;

  client.defineCommand(REALTIME_PUBLISH_COMMAND, {
    numberOfKeys: 2,
    lua: loadRealtimePublishScript(),
  });
}
