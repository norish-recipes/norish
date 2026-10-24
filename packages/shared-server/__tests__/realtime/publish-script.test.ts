/**
 * The `realtimePublish` Lua script against compose's Valkey, connected with the
 * production options: a Lua script can only be proven by Valkey itself.
 */

// @vitest-environment node

import type { StartedValkeyContainer } from "@testcontainers/valkey";
import { ValkeyContainer } from "@testcontainers/valkey";
import Valkey from "ioredis";
import superjson from "superjson";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

import { EVENT_ID_PLACEHOLDER } from "../../src/realtime/domain";
import {
  registerRealtimePublish,
  RESUME_MAXLEN,
  RESUME_TTL_SECONDS,
} from "../../src/realtime/resume";
import { getValkeyConnectionOptions } from "../../src/valkey/client";
import { VALKEY_IMAGE, valkeyUrl } from "../helpers/valkey";

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: { VALKEY_URL: "" } }));

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

describe("realtimePublish against Valkey", () => {
  let container: StartedValkeyContainer;
  let publisher: Valkey;
  let subscriber: Valkey;

  beforeAll(async () => {
    container = await new ValkeyContainer(VALKEY_IMAGE).start();
    publisher = new Valkey(getValkeyConnectionOptions(valkeyUrl(container)));
    subscriber = publisher.duplicate();
    registerRealtimePublish(publisher);
    await subscriber.subscribe(CHANNEL);
  });

  afterAll(async () => {
    await subscriber?.quit();
    await publisher?.quit();
    await container?.stop();
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
