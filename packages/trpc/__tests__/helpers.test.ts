import { afterEach, describe, expect, it, vi } from "vitest";

import type { SubscriptionMultiplexer } from "@norish/shared-server/redis/subscription-multiplexer";
import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime-envelope";
import { trpcLogger } from "@norish/shared-server/logger";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime-envelope";

import type { TypedEmitter } from "../src/emitter";
import {
  createEnvelopeSubscriptionIterable,
  createSubscriptionIterable,
  mergeAsyncIterables,
} from "../src/helpers";

type TestPayload = { id: string };

afterEach(() => {
  vi.restoreAllMocks();
});

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];

  for await (const value of iterable) {
    values.push(value);
  }

  return values;
}

function createEnvelope(payload: TestPayload): RealtimeEventEnvelope<TestPayload> {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "event-1",
      eventName: "created",
      namespace: "test",
      scope: "household",
      channel: "norish:test:household:household-1:created",
      occurredAt: "2026-06-01T00:00:00.000Z",
    },
    payload,
  };
}

function createEmitter(values: unknown[]) {
  return {
    async *createSubscription() {
      for (const value of values) {
        yield value;
      }
    },
  } as unknown as TypedEmitter<Record<string, TestPayload>>;
}

function createMultiplexer(values: unknown[]) {
  return {
    async *subscribe() {
      for (const value of values) {
        yield value;
      }
    },
  } as unknown as SubscriptionMultiplexer;
}

describe("subscription helpers", () => {
  it("unwraps realtime envelopes from direct subscriptions", async () => {
    const payload = { id: "grocery-1" };
    const iterable = createSubscriptionIterable<TestPayload>(
      createEmitter([createEnvelope(payload)]),
      null,
      "created"
    );

    await expect(collect(iterable)).resolves.toEqual([payload]);
  });

  it("unwraps realtime envelopes from multiplexed subscriptions", async () => {
    const payload = { id: "grocery-1" };
    const iterable = createSubscriptionIterable<TestPayload>(
      createEmitter([]),
      createMultiplexer([createEnvelope(payload)]),
      "created"
    );

    await expect(collect(iterable)).resolves.toEqual([payload]);
  });

  it("continues to pass through raw subscription payloads", async () => {
    const payload = { id: "grocery-1" };
    const iterable = createSubscriptionIterable<TestPayload>(
      createEmitter([payload]),
      null,
      "created"
    );

    await expect(collect(iterable)).resolves.toEqual([payload]);
  });

  it("keeps envelopes available for envelope-aware consumers", async () => {
    const envelope = createEnvelope({ id: "grocery-1" });
    const iterable = createEnvelopeSubscriptionIterable<TestPayload>(
      createEmitter([envelope]),
      null,
      "created"
    );

    await expect(collect(iterable)).resolves.toEqual([envelope]);
  });

  it("rejects raw payloads for envelope-aware direct subscriptions", async () => {
    const errorSpy = vi.spyOn(trpcLogger, "error").mockImplementation(() => undefined);
    const payload = { id: "grocery-1" };
    const iterable = createEnvelopeSubscriptionIterable<TestPayload>(
      createEmitter([payload]),
      null,
      "created"
    );

    await expect(collect(iterable)).rejects.toThrow(
      'Expected realtime event envelope from subscription channel "created"'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      { err: expect.any(TypeError), channel: "created" },
      "Rejected non-envelope realtime subscription data"
    );
  });

  it("rejects malformed envelopes for envelope-aware multiplexed subscriptions", async () => {
    const errorSpy = vi.spyOn(trpcLogger, "error").mockImplementation(() => undefined);
    const malformedEnvelope = {
      meta: {
        version: ENVELOPE_VERSION,
        eventId: "event-1",
      },
      payload: { id: "grocery-1" },
    };
    const iterable = createEnvelopeSubscriptionIterable<TestPayload>(
      createEmitter([]),
      createMultiplexer([malformedEnvelope]),
      "created"
    );

    await expect(collect(iterable)).rejects.toThrow(
      'Expected realtime event envelope from subscription channel "created"'
    );
    expect(errorSpy).toHaveBeenCalledWith(
      { err: expect.any(TypeError), channel: "created" },
      "Rejected non-envelope realtime subscription data"
    );
  });

  it("propagates source iterable errors when merging subscriptions", async () => {
    async function* failingIterable(): AsyncGenerator<TestPayload> {
      throw new TypeError("subscription failed");
    }

    await expect(collect(mergeAsyncIterables([failingIterable()]))).rejects.toThrow(
      "subscription failed"
    );
  });
});
