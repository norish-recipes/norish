import { describe, expect, it } from "vitest";

import { classifyReplayError, isStaleResult } from "@/lib/outbox/error-classification";

describe("classifyReplayError", () => {
  it("classifies a network failure as unreachable (halt, resume on recovery)", () => {
    expect(classifyReplayError(new TypeError("Failed to fetch"))).toBe("unreachable");
    expect(classifyReplayError(new TypeError("network request failed"))).toBe("unreachable");
  });

  it("classifies a 401 as unauthorized (halt the whole queue)", () => {
    expect(classifyReplayError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).toBe(
      "unauthorized"
    );
  });

  it("classifies a 5xx as ambiguous (bounded retry)", () => {
    expect(classifyReplayError({ data: { httpStatus: 500 } })).toBe("ambiguous");
    expect(classifyReplayError({ data: { httpStatus: 503 } })).toBe("ambiguous");
  });

  it("classifies a 4xx (or statusless) rejection as deterministic (park, keep draining)", () => {
    expect(classifyReplayError({ data: { httpStatus: 400, code: "BAD_REQUEST" } })).toBe(
      "deterministic"
    );
    expect(classifyReplayError({ data: { code: "CONFLICT" } })).toBe("deterministic");
    expect(classifyReplayError(new Error("boom"))).toBe("deterministic");
  });

  it("treats 401 ahead of any status heuristic", () => {
    expect(classifyReplayError({ data: { code: "UNAUTHORIZED", httpStatus: 401 } })).not.toBe(
      "deterministic"
    );
  });
});

describe("isStaleResult", () => {
  it("detects a first-writer-wins dropped write", () => {
    expect(isStaleResult({ success: true, stale: true })).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isStaleResult({ success: true })).toBe(false);
    expect(isStaleResult({ stale: false })).toBe(false);
    expect(isStaleResult(null)).toBe(false);
    expect(isStaleResult("stale")).toBe(false);
    expect(isStaleResult(undefined)).toBe(false);
  });
});
