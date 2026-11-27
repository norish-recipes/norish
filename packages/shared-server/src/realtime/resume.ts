/**
 * Resume
 *
 * The bounded buffer behind every non-internal publish (ADR-0034): a
 * per-channel Valkey Stream written by the same Lua script that publishes, and
 * an opaque Cursor, signed for its identity, the client hands back on reconnect.
 *
 * This module owns the bounds, the stream-id arithmetic, the cursor codec and
 * the registration of the `realtimePublish` script on the publisher client.
 * The resume algorithm itself lives beside the tRPC subscription factory.
 */

import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type Valkey from "ioredis";
import type { Result } from "ioredis";

import { hmacIndex } from "@norish/config/crypto";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";
import { getPublisherClient } from "@norish/shared-server/valkey/client";
import { currentToken, freshToken } from "@norish/shared-server/valkey/token";

import { RealtimeLaggedError } from "./hub";

/** Approximate entries kept per channel stream (`XADD MAXLEN ~`). */
export const RESUME_MAXLEN = 1000;
/** Seconds a channel stream lives after its last write. */
export const RESUME_TTL_SECONDS = 86_400;

/** "Nothing seen on this channel." */
export const ZERO_STREAM_ID = "0-0";

const CURSOR_VERSION = "2";
/** Keeps the cursor's tag apart from the email and share-token hashes under the same key. */
const CURSOR_TAG_LABEL = "norish:realtime-cursor";
const CURSOR_TAG = /^[0-9a-f]{32}$/;
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
  householdId: string;
  /** The View Epoch at subscribe: a cursor minted under an earlier one is refused. */
  viewEpoch: string;
}

const VIEW_EPOCH_KEY = "norish:realtime:view-epoch";

// ponytail: one epoch for the server; a per-household one if membership changes grow common.
/** Moves after a policy or membership change, so no event buffered under the old view replays. */
export async function bumpViewEpoch(): Promise<void> {
  await (await getPublisherClient()).set(VIEW_EPOCH_KEY, freshToken());
}

export async function readViewEpoch(): Promise<string> {
  return currentToken(await getPublisherClient(), VIEW_EPOCH_KEY);
}

export interface RealtimeCursor {
  identity: RealtimeIdentity;
  /** The channels it resumes, in `channelsFor()` order. */
  channels: string[];
  /** One stream id per channel. */
  ids: string[];
}

/** 128 bits of an HMAC under the Master Key over the version, identity, channels and ids. */
function cursorTag({ identity, channels, ids }: RealtimeCursor): string {
  const { userId, householdId, viewEpoch } = identity;
  const signed = [CURSOR_TAG_LABEL, CURSOR_VERSION, userId, householdId, viewEpoch, channels, ids];

  return hmacIndex(JSON.stringify(signed)).slice(0, 32);
}

/** `2.<tag>.<id0>,<id1>[,<id2>]` — opaque to the client. */
export function encodeCursor(cursor: RealtimeCursor): string {
  return `${CURSOR_VERSION}.${cursorTag(cursor)}.${cursor.ids.join(",")}`;
}

/**
 * Open a client's cursor for the current identity and channels: malformed is Lagged
 * `cursor-invalid`, a tag not minted for them (or for these ids) `identity-changed`.
 */
export function decodeCursor(
  raw: string,
  identity: RealtimeIdentity,
  channels: string[]
): RealtimeCursor {
  const invalid = () => new RealtimeLaggedError("", "cursor-invalid", 0);

  if (typeof raw !== "string") throw invalid();

  const parts = raw.split(".");

  if (parts.length !== 3 || parts[0] !== CURSOR_VERSION) throw invalid();

  const tag = parts[1]!;

  if (!CURSOR_TAG.test(tag)) throw invalid();

  const ids = parts[2]!.split(",");

  if (ids.length === 0 || ids.some((id) => !parseStreamId(id))) throw invalid();

  const cursor = { identity, channels, ids };

  // A user who left a household never reads that household's stream, and no
  // client writes its own ids: both are refused before the buffer is read.
  if (!timingSafeEqual(Buffer.from(cursorTag(cursor)), Buffer.from(tag))) {
    throw new RealtimeLaggedError(channels[0] ?? "", "identity-changed", 0);
  }

  return cursor;
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
export function registerRealtimePublish(client: Valkey): void {
  if (typeof client.realtimePublish === "function") return;

  client.defineCommand(REALTIME_PUBLISH_COMMAND, {
    numberOfKeys: 2,
    lua: loadRealtimePublishScript(),
  });
}
