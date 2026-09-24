import { describe, expect, it } from "vitest";

import { generateOperationId, isOperationId } from "@norish/shared/lib/operation-helpers";

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
