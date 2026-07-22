import type { OutboxEntry } from "@/lib/outbox/outbox-types";
import { substituteEntryIds, substituteIdsInValue } from "@/lib/outbox/id-substitution";
import { encodeOutboxInput } from "@/lib/outbox/input-codec";
import { describe, expect, it } from "vitest";

const clientId = "11111111-1111-4111-8111-111111111111";
const canonicalId = "22222222-2222-4222-8222-222222222222";
const map = new Map([[clientId, canonicalId]]);

function storedEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    seq: 1,
    id: "e",
    ownerId: "u1",
    path: "groceries.toggle",
    input: {},
    entityId: null,
    operationId: null,
    headers: {},
    createdAt: "2026-07-22T00:00:00.000Z",
    attempts: 0,
    status: "pending",
    ...overrides,
  };
}

describe("substituteIdsInValue", () => {
  it("replaces exact matching UUID strings deep in objects and arrays", () => {
    const input = {
      groceries: [{ id: clientId, version: 1 }],
      note: `${clientId} embedded in prose stays`,
      other: "33333333-3333-4333-8333-333333333333",
    };

    const result = substituteIdsInValue(input, map) as typeof input;

    expect(result.groceries[0]?.id).toBe(canonicalId);
    expect(result.note).toBe(`${clientId} embedded in prose stays`);
    expect(result.other).toBe("33333333-3333-4333-8333-333333333333");
  });

  it("returns the same reference when nothing matches", () => {
    const input = { id: "unrelated", nested: { list: ["x"] } };

    expect(substituteIdsInValue(input, map)).toBe(input);
  });

  it("rewrites encoded FormData entry values but never keys, and skips files", () => {
    const formData = new FormData();

    formData.append("recipeId", clientId);
    formData.append("photo", new File(["x"], "a.png", { type: "image/png" }));

    const encoded = encodeOutboxInput(formData);
    const result = substituteIdsInValue(encoded, map) as {
      entries: Array<[string, unknown]>;
    };

    expect(result.entries[0]).toEqual(["recipeId", canonicalId]);
    expect(result.entries[1]?.[1]).toBeInstanceOf(File);
  });
});

describe("substituteEntryIds", () => {
  it("rewrites the input and the entityId dependency metadata", () => {
    const rewritten = substituteEntryIds(
      storedEntry({ input: { id: clientId }, entityId: clientId }),
      map
    );

    expect(rewritten.input).toEqual({ id: canonicalId });
    expect(rewritten.entityId).toBe(canonicalId);
  });

  it("returns the same entry reference when nothing matches", () => {
    const entry = storedEntry({ input: { id: "other" }, entityId: "other" });

    expect(substituteEntryIds(entry, map)).toBe(entry);
  });
});
