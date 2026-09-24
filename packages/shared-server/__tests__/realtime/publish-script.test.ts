/**
 * The `realtimePublish` Lua script against a real Redis.
 *
 * Skipped unless `REDIS_URL` is set: everything else in this package runs
 * against fakes, but a Lua script can only be proven by Redis itself.
 */

// @vitest-environment node

import Redis from "ioredis";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

import { EVENT_ID_PLACEHOLDER } from "../../src/realtime/domain";
import {
  registerRealtimePublish,
  RESUME_MAXLEN,
  RESUME_TTL_SECONDS,
} from "../../src/realtime/resume";
import { parseRedisUrl } from "../../src/redis/url";

const REDIS_URL = process.env.REDIS_URL;

const CHANNEL = `norish:test:household:${process.pid}:published`;
const STREAM = `norish:stream:test:household:${process.pid}:published`;

function envelope(payload: unknown): RealtimeEventEnvelope {
  return {
    meta: {
      version: 1,
      eventId: EVENT_ID_PLACEHOLDER,
      eventName: "published",
      namespace: "test",
      scope: "household",
      channel: CHANNEL,
      occurredAt: new Date().toISOString(),
    },
    payload,
  };
}

describe.skipIf(!REDIS_URL)("realtimePublish against Redis", () => {
  let publisher: Redis;
  let subscriber: Redis;

  beforeAll(async () => {
    publisher = new Redis(parseRedisUrl(REDIS_URL!));
    subscriber = publisher.duplicate();
    registerRealtimePublish(publisher);
    await subscriber.subscribe(CHANNEL);
  });

  afterAll(async () => {
    await publisher.del(STREAM);
    await subscriber.quit();
    await publisher.quit();
  });

  it("publishes the envelope with the stream entry id in place of the placeholder", async () => {
    const received = new Promise<string>((resolve) => {
      subscriber.once("message", (_channel, message) => resolve(message));
    });

    const id = await publisher.realtimePublish(
      STREAM,
      CHANNEL,
      superjson.stringify(envelope({ text: 'contains "eventId":"$ID$" too' })),
      RESUME_MAXLEN,
      RESUME_TTL_SECONDS
    );
    const message = await received;
    const parsed = superjson.parse<RealtimeEventEnvelope<{ text: string }>>(message);

    expect(id).toMatch(/^\d+-\d+$/);
    expect(parsed.meta.eventId).toBe(id);
    expect(message.indexOf(`"eventId":"${id}"`)).toBeLessThan(message.indexOf("payload"));
    // Only the meta placeholder is replaced; the payload is not a pattern to rewrite.
    expect(parsed.payload.text).toBe('contains "eventId":"$ID$" too');
  });

  it("appends the entry to the stream and refreshes its TTL", async () => {
    const id = await publisher.realtimePublish(
      STREAM,
      CHANNEL,
      superjson.stringify(envelope({ n: 2 })),
      RESUME_MAXLEN,
      RESUME_TTL_SECONDS
    );
    const entries = await publisher.xrange(STREAM, id, id);
    const ttl = await publisher.ttl(STREAM);

    expect(entries).toHaveLength(1);
    expect(entries[0]![1][0]).toBe("e");
    expect(superjson.parse<RealtimeEventEnvelope>(entries[0]![1][1]!).payload).toEqual({ n: 2 });
    expect(ttl).toBeGreaterThan(RESUME_TTL_SECONDS - 60);
    expect(ttl).toBeLessThanOrEqual(RESUME_TTL_SECONDS);
  });
});
