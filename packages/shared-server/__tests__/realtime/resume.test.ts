import { describe, expect, it } from "vitest";

import { RealtimeLaggedError } from "../../src/realtime/hub";
import {
  compareStreamIds,
  decodeCursor,
  encodeCursor,
  isStreamIdExpired,
  loadRealtimePublishScript,
  parseStreamId,
  RESUME_MAXLEN,
  RESUME_TTL_SECONDS,
} from "../../src/realtime/resume";

describe("bounds", () => {
  it("are fixed in code", () => {
    expect(RESUME_MAXLEN).toBe(1000);
    expect(RESUME_TTL_SECONDS).toBe(86_400);
  });
});

describe("parseStreamId", () => {
  it("parses <ms>-<seq>", () => {
    expect(parseStreamId("1700000000000-3")).toEqual({ ms: 1_700_000_000_000, seq: 3 });
    expect(parseStreamId("0-0")).toEqual({ ms: 0, seq: 0 });
  });

  it("rejects anything else", () => {
    expect(parseStreamId("")).toBeNull();
    expect(parseStreamId("abc")).toBeNull();
    expect(parseStreamId("1-")).toBeNull();
    expect(parseStreamId("1-2-3")).toBeNull();
    expect(parseStreamId("uuid-like-1234")).toBeNull();
  });
});

describe("compareStreamIds", () => {
  it("orders (ms, seq) tuples, not strings", () => {
    expect(compareStreamIds("999-0", "1000-0")).toBeLessThan(0);
    expect(compareStreamIds("1000-0", "999-0")).toBeGreaterThan(0);
    expect(compareStreamIds("1000-2", "1000-10")).toBeLessThan(0);
    expect(compareStreamIds("1000-10", "1000-2")).toBeGreaterThan(0);
    expect(compareStreamIds("1000-5", "1000-5")).toBe(0);
    expect(compareStreamIds("0-0", "1-0")).toBeLessThan(0);
  });

  it("refuses a non stream id", () => {
    expect(() => compareStreamIds("nope", "1-0")).toThrow(/Not a stream id: nope/);
  });
});

describe("cursor codec", () => {
  const identity = { userId: "u-1", householdId: "hh-1", viewEpoch: "0" };
  const channels = ["norish:a:household:hh-1:x", "norish:a:broadcast:x", "norish:a:user:u-1:x"];
  const cursor = { identity, channels, ids: ["1700000000000-1", "0-0", "1700000000002-0"] };

  function refusal(raw: string, opened = identity, on = channels): string | undefined {
    try {
      decodeCursor(raw, opened, on);
    } catch (err) {
      expect(err).toBeInstanceOf(RealtimeLaggedError);

      return (err as RealtimeLaggedError).reason;
    }
  }

  it("round-trips a policy cursor with three ids under a 128-bit tag", () => {
    const encoded = encodeCursor(cursor);

    expect(encoded).toMatch(/^2\.[0-9a-f]{32}\.1700000000000-1,0-0,1700000000002-0$/);
    expect(decodeCursor(encoded, identity, channels)).toEqual(cursor);
  });

  it("round-trips a single-channel cursor", () => {
    const single = { identity, channels: channels.slice(0, 1), ids: ["1700000000000-1"] };

    expect(decodeCursor(encodeCursor(single), identity, single.channels)).toEqual(single);
  });

  it.each([
    [
      "ids it did not mint",
      (raw: string) => raw.replace(/[^.]+$/, "0-0,0-0,0-0"),
      identity,
      channels,
    ],
    ["another user", (raw: string) => raw, { ...identity, userId: "u-2" }, channels],
    ["another household", (raw: string) => raw, { ...identity, householdId: "hh-2" }, channels],
    ["another View Epoch", (raw: string) => raw, { ...identity, viewEpoch: "1" }, channels],
    [
      "other channels",
      (raw: string) => raw,
      identity,
      ["norish:b:broadcast:y", ...channels.slice(1)],
    ],
  ])("refuses %s as identity-changed", (_, tamper, opened, on) => {
    expect(refusal(tamper(encodeCursor(cursor)), opened, on)).toBe("identity-changed");
  });

  it.each([
    "",
    "garbage",
    "1.72a4dd48.1700000000000-1",
    "3.00000000000000000000000000000000.1-0",
    "2.nothex!!nothex!!nothex!!nothex!!.1-0",
    "2.00000000.1-0",
    "2.00000000000000000000000000000000.",
    "2.00000000000000000000000000000000.1-0,abc",
    "2.00000000000000000000000000000000.1-0.extra",
    "2..1-0",
  ])("decodes %j to cursor-invalid", (raw) => {
    expect(refusal(raw)).toBe("cursor-invalid");
  });
});

describe("isStreamIdExpired", () => {
  const now = 1_700_000_000_000;

  it("is false for 0-0 and for ids younger than the TTL", () => {
    expect(isStreamIdExpired("0-0", now)).toBe(false);
    expect(isStreamIdExpired(`${now - 1_000}-0`, now)).toBe(false);
    expect(isStreamIdExpired(`${now - RESUME_TTL_SECONDS * 1_000}-0`, now)).toBe(false);
  });

  it("is true once the id is older than the TTL", () => {
    expect(isStreamIdExpired(`${now - RESUME_TTL_SECONDS * 1_000 - 1}-0`, now)).toBe(true);
  });
});

describe("publish script", () => {
  it("does a plain find of the placeholder and reads once", () => {
    const script = loadRealtimePublishScript();

    expect(script).toContain("string.find(envelope, placeholder, 1, true)");
    expect(script).toContain("'XADD', KEYS[1], 'MAXLEN', '~', ARGV[2]");
    expect(script).toContain("'PUBLISH', KEYS[2]");
    expect(script).toContain("'EXPIRE', KEYS[1], ARGV[3]");
    expect(loadRealtimePublishScript()).toBe(script);
  });
});
