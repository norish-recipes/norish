// @vitest-environment node
import { describe, expect, it } from "vitest";

import { unwrapRealtimeEventEnvelope } from "@norish/api/caldav/event-listener";

describe("unwrapRealtimeEventEnvelope", () => {
  it("unwraps a RealtimeEventEnvelope to its payload", () => {
    const payload = {
      item: {
        id: "00000000-0000-0000-0000-000000000001",
        userId: "user_1",
        itemType: "recipe",
        date: "2026-06-09",
        slot: "Dinner",
        recipeName: "Test Recipe",
      },
    };
    const envelope = {
      meta: {
        version: 1,
        eventId: "11111111-1111-1111-1111-111111111111",
        eventName: "itemCreated",
        namespace: "calendar",
        scope: "household",
        channel: "norish:calendar:household:hh_1:itemCreated",
        occurredAt: "2026-06-05T00:00:00.000Z",
      },
      payload,
    };

    expect(unwrapRealtimeEventEnvelope(envelope)).toBe(payload);
  });

  it("passes through legacy un-enveloped payloads unchanged", () => {
    // Pre-envelope-refactor publishes wrote the payload directly.
    const legacy = {
      item: {
        id: "00000000-0000-0000-0000-000000000002",
        userId: "user_2",
        itemType: "recipe",
        date: "2026-06-09",
        slot: "Dinner",
        recipeName: "Legacy Shape",
      },
    };

    expect(unwrapRealtimeEventEnvelope(legacy)).toBe(legacy);
  });

  it("passes through itemDeleted envelopes too", () => {
    const payload = { itemId: "00000000-0000-0000-0000-000000000003" };
    const envelope = {
      meta: {
        version: 1,
        eventId: "22222222-2222-2222-2222-222222222222",
        eventName: "itemDeleted",
        namespace: "calendar",
        scope: "household",
        channel: "norish:calendar:household:hh_1:itemDeleted",
        occurredAt: "2026-06-05T00:00:00.000Z",
      },
      payload,
    };

    expect(unwrapRealtimeEventEnvelope(envelope)).toBe(payload);
  });

  it("returns null/undefined inputs as-is", () => {
    expect(unwrapRealtimeEventEnvelope(null)).toBeNull();
    expect(unwrapRealtimeEventEnvelope(undefined)).toBeUndefined();
  });

  it("does not mistake an object with only `meta` for an envelope", () => {
    const partial = { meta: { foo: "bar" } };
    expect(unwrapRealtimeEventEnvelope(partial)).toBe(partial);
  });

  it("does not mistake an object with only `payload` for an envelope", () => {
    const partial = { payload: { x: 1 } };
    expect(unwrapRealtimeEventEnvelope(partial)).toBe(partial);
  });
});
