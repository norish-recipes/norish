import { describe, expect, it } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime-envelope";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime-envelope";
import {
  extractMeta,
  generateOperationId,
  isEventEnvelope,
  isOperationId,
  normalizeSubscriptionData,
  unwrapPayload,
} from "@norish/shared/lib/operation-helpers";

describe("generateOperationId", () => {
  it("generates a non-empty string", () => {
    const id = generateOperationId();

    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateOperationId()));

    expect(ids.size).toBe(100);
  });

  it("generates UUIDs", () => {
    const id = generateOperationId();

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("isOperationId", () => {
  it("returns true for non-empty strings", () => {
    expect(isOperationId("abc-123")).toBe(true);
    expect(isOperationId(generateOperationId())).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isOperationId("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isOperationId(null)).toBe(false);
    expect(isOperationId(undefined)).toBe(false);
    expect(isOperationId(123)).toBe(false);
    expect(isOperationId({})).toBe(false);
  });
});

describe("isEventEnvelope", () => {
  const envelope: RealtimeEventEnvelope<{ recipeId: string }> = {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "evt-1",
      eventName: "imported",
      namespace: "recipes",
      scope: "household",
      channel: "norish:recipes:household:hh1:imported",
      occurredAt: new Date().toISOString(),
    },
    payload: { recipeId: "r-1" },
  };

  it("detects a valid envelope", () => {
    expect(isEventEnvelope(envelope)).toBe(true);
  });

  it("rejects raw domain payloads", () => {
    expect(isEventEnvelope({ recipeId: "r-1" })).toBe(false);
  });

  it("rejects nullish values", () => {
    expect(isEventEnvelope(null)).toBe(false);
    expect(isEventEnvelope(undefined)).toBe(false);
  });

  it("rejects objects missing meta", () => {
    expect(isEventEnvelope({ payload: {} })).toBe(false);
  });

  it("rejects objects with non-object meta", () => {
    expect(isEventEnvelope({ meta: "string", payload: {} })).toBe(false);
  });

  it("rejects objects with meta missing version", () => {
    expect(isEventEnvelope({ meta: { eventId: "1" }, payload: {} })).toBe(false);
  });
});

describe("normalizeSubscriptionData", () => {
  it("returns meta and payload from an envelope", () => {
    const envelope: RealtimeEventEnvelope<{ id: string }> = {
      meta: {
        version: ENVELOPE_VERSION,
        eventId: "evt-1",
        eventName: "created",
        namespace: "recipes",
        scope: "broadcast",
        channel: "norish:recipes:broadcast:created",
        occurredAt: "2024-01-01T00:00:00Z",
      },
      payload: { id: "abc" },
    };

    const result = normalizeSubscriptionData<{ id: string }>(envelope);

    expect(result.meta).toBe(envelope.meta);
    expect(result.payload).toEqual({ id: "abc" });
  });

  it("returns null meta for raw domain payloads", () => {
    const rawPayload = { recipeId: "r-1", name: "Test" };
    const result = normalizeSubscriptionData(rawPayload);

    expect(result.meta).toBeNull();
    expect(result.payload).toBe(rawPayload);
  });
});

describe("unwrapPayload", () => {
  it("extracts payload from an envelope", () => {
    const envelope: RealtimeEventEnvelope = {
      meta: {
        version: ENVELOPE_VERSION,
        eventId: "evt-1",
        eventName: "created",
        namespace: "recipes",
        scope: "broadcast",
        channel: "c",
        occurredAt: "2024-01-01T00:00:00Z",
      },
      payload: { id: "123" },
    };

    expect(unwrapPayload(envelope)).toEqual({ id: "123" });
  });

  it("returns the data as-is for raw payloads", () => {
    const raw = { id: "123" };

    expect(unwrapPayload(raw)).toBe(raw);
  });
});

describe("extractMeta", () => {
  it("extracts meta from an envelope", () => {
    const envelope: RealtimeEventEnvelope = {
      meta: {
        version: ENVELOPE_VERSION,
        eventId: "evt-1",
        eventName: "created",
        namespace: "recipes",
        scope: "broadcast",
        channel: "c",
        occurredAt: "2024-01-01T00:00:00Z",
        operationId: generateOperationId(),
      },
      payload: {},
    };

    expect(extractMeta(envelope)).toBe(envelope.meta);
  });

  it("returns null for raw payloads", () => {
    expect(extractMeta({ id: "123" })).toBeNull();
  });
});

describe("preserving precomputed operationIds", () => {
  it("an existing operationId passes isOperationId check", () => {
    const precomputed = generateOperationId();

    expect(isOperationId(precomputed)).toBe(true);
  });

  it("generateOperationId survives JSON round-trip", () => {
    const original = generateOperationId();
    const roundTripped = JSON.parse(JSON.stringify(original));

    expect(isOperationId(roundTripped)).toBe(true);
    expect(roundTripped).toBe(original);
  });
});
