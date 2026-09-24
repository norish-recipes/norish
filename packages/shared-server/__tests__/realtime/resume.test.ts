import { describe, expect, it } from "vitest";

import { RealtimeLaggedError } from "../../src/realtime/hub";
import {
  compareStreamIds,
  decodeCursor,
  encodeCursor,
  identityHashFor,
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

describe("identityHashFor", () => {
  it("is eight hex characters of sha1(userId|householdKey)", () => {
    const hash = identityHashFor({ userId: "u-1", householdKey: "hh-1" });

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
    expect(hash).toBe("8ca3af7f");
    expect(identityHashFor({ userId: "u-1", householdKey: "hh-2" })).not.toBe(hash);
  });
});

describe("cursor codec", () => {
  it("round-trips a policy cursor with three ids", () => {
    const cursor = { identityHash: "8ca3af7f", ids: ["1700000000000-1", "0-0", "1700000000002-0"] };
    const encoded = encodeCursor(cursor);

    expect(encoded).toBe("1.8ca3af7f.1700000000000-1,0-0,1700000000002-0");
    expect(decodeCursor(encoded)).toEqual(cursor);
  });

  it("round-trips a single-channel cursor", () => {
    const cursor = { identityHash: "8ca3af7f", ids: ["1700000000000-1"] };

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    "",
    "garbage",
    "2.8ca3af7f.1-0",
    "1.nothex!!.1-0",
    "1.8ca3af7f.",
    "1.8ca3af7f.1-0,abc",
    "1.8ca3af7f.1-0.extra",
    "1..1-0",
  ])("decodes %j to cursor-invalid", (raw) => {
    let caught: unknown;

    try {
      decodeCursor(raw);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RealtimeLaggedError);
    expect((caught as RealtimeLaggedError).reason).toBe("cursor-invalid");
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
