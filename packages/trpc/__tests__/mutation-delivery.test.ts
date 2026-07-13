import { describe, expect, it } from "vitest";

import { canonicalRequestFingerprint } from "../src/receipt-fingerprint";
import { deserializeReceiptResponse, serializeReceiptResponse } from "../src/receipt-response";

describe("mutation delivery receipts", () => {
  it("fingerprints equivalent SuperJSON inputs canonically", async () => {
    const first = await canonicalRequestFingerprint("recipes.update", {
      title: "Soup",
      version: 2,
    });
    const second = await canonicalRequestFingerprint("recipes.update", {
      version: 2,
      title: "Soup",
    });

    expect(second).toBe(first);
    expect(
      await canonicalRequestFingerprint("recipes.update", { title: "Stew", version: 2 })
    ).not.toBe(first);
  });

  it("canonically fingerprints maps and sets containing SuperJSON-only values", async () => {
    const first = await canonicalRequestFingerprint("recipes.update", {
      map: new Map<unknown, unknown>([
        [2n, undefined],
        [1n, new Date("2026-07-10T00:00:00Z")],
      ]),
      set: new Set<unknown>([undefined, 2n, 1n]),
    });
    const reordered = await canonicalRequestFingerprint("recipes.update", {
      set: new Set<unknown>([1n, undefined, 2n]),
      map: new Map<unknown, unknown>([
        [1n, new Date("2026-07-10T00:00:00Z")],
        [2n, undefined],
      ]),
    });

    expect(reordered).toBe(first);
  });

  it("includes ordered FormData values and binary content hashes", async () => {
    const first = new FormData();
    first.append("tag", "one");
    first.append("tag", "two");
    first.append("file", new File(["abc"], "notes.txt", { type: "text/plain", lastModified: 123 }));

    const same = new FormData();
    same.append("tag", "one");
    same.append("tag", "two");
    same.append("file", new File(["abc"], "notes.txt", { type: "text/plain", lastModified: 123 }));

    const changedOrder = new FormData();
    changedOrder.append("tag", "two");
    changedOrder.append("tag", "one");
    changedOrder.append(
      "file",
      new File(["abc"], "notes.txt", { type: "text/plain", lastModified: 123 })
    );

    const firstFingerprint = await canonicalRequestFingerprint("archive.import", first);

    expect(await canonicalRequestFingerprint("archive.import", same)).toBe(firstFingerprint);
    expect(await canonicalRequestFingerprint("archive.import", changedOrder)).not.toBe(
      firstFingerprint
    );
  });

  it("encrypts and round-trips transformed response values", () => {
    const response = {
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
      bytes: new Uint8Array([1, 2, 3]),
      token: "one-time-secret",
    };
    const encrypted = serializeReceiptResponse(response);

    expect(encrypted).not.toContain("one-time-secret");
    expect(deserializeReceiptResponse<typeof response>(encrypted)).toEqual(response);
  });
});
