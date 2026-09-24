import { describe, expect, it } from "vitest";

import {
  assertEventEnvelope,
  CURSOR_MARK,
  ENVELOPE_VERSION,
  isCursorMark,
  isEventEnvelope,
  REALTIME_LAGGED,
} from "@norish/shared/contracts/realtime/envelope";

const envelope = {
  meta: {
    version: ENVELOPE_VERSION,
    eventId: "1700000000000-0",
    eventName: "created",
    namespace: "grocery",
    scope: "household",
    channel: "norish:grocery:household:hh-1:created",
    occurredAt: "2024-01-01T00:00:00.000Z",
  },
  payload: { ids: ["g-1"] },
};

describe("isEventEnvelope", () => {
  it("accepts an envelope for every channel scope", () => {
    for (const scope of ["household", "user", "broadcast", "internal"]) {
      expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, scope } })).toBe(true);
    }
  });

  it("accepts an optional operationId only when it is a non-empty string", () => {
    expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, operationId: "op-1" } })).toBe(
      true
    );
    expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, operationId: "" } })).toBe(
      false
    );
    expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, operationId: 1 } })).toBe(
      false
    );
  });

  it("rejects the retired global scope, raw payloads and the Cursor Mark", () => {
    expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, scope: "global" } })).toBe(
      false
    );
    expect(isEventEnvelope({ ids: ["g-1"] })).toBe(false);
    expect(isEventEnvelope(CURSOR_MARK)).toBe(false);
    expect(isEventEnvelope(null)).toBe(false);
    expect(isEventEnvelope({ ...envelope, meta: { ...envelope.meta, version: 2 } })).toBe(false);
  });
});

describe("assertEventEnvelope", () => {
  it("throws a TypeError for anything that is not an envelope", () => {
    expect(() => assertEventEnvelope({ mark: "cursor" })).toThrow(TypeError);
    expect(() => assertEventEnvelope(envelope)).not.toThrow();
  });
});

describe("isCursorMark", () => {
  it("recognises the Cursor Mark and nothing else", () => {
    expect(isCursorMark(CURSOR_MARK)).toBe(true);
    expect(isCursorMark({ mark: "cursor" })).toBe(true);
    expect(isCursorMark(envelope)).toBe(false);
    expect(isCursorMark({ mark: "cursor", meta: envelope.meta, payload: {} })).toBe(false);
    expect(isCursorMark("cursor")).toBe(false);
  });
});

describe("constants", () => {
  it("pins the Lagged message the client reacts to", () => {
    expect(REALTIME_LAGGED).toBe("REALTIME_LAGGED");
    expect(Object.isFrozen(CURSOR_MARK)).toBe(true);
  });
});
