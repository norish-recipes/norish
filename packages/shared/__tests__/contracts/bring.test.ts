import { describe, expect, it } from "vitest";

import {
  BringItemSchema,
  SendToBringInputSchema,
  SendToBringResultSchema,
} from "../../src/contracts/zod/bring";

describe("BringItemSchema", () => {
  it("accepts any finite amount, including zero and negative ones", () => {
    for (const amount of [0, -2, 0.001, 1e9, null]) {
      expect(BringItemSchema.safeParse({ name: "Mehl", amount }).success).toBe(true);
    }
  });

  it("rejects an amount JSON cannot carry", () => {
    expect(BringItemSchema.safeParse({ name: "Mehl", amount: Number.NaN }).success).toBe(false);
    expect(BringItemSchema.safeParse({ name: "Mehl", amount: Infinity }).success).toBe(false);
  });

  it("trims a name and a unit, and cuts them to their caps instead of refusing them", () => {
    const parsed = BringItemSchema.parse({
      name: `  ${"n".repeat(300)}  `,
      unit: ` ${"u".repeat(90)} `,
    });

    expect(parsed.name).toBe("n".repeat(200));
    expect(parsed.unit).toBe("u".repeat(40));
  });

  it("lets an empty name through for the server to ignore", () => {
    expect(BringItemSchema.parse({ name: "   " }).name).toBe("");
  });
});

describe("SendToBringInputSchema", () => {
  it("needs at least one item and takes at most 150", () => {
    expect(SendToBringInputSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      SendToBringInputSchema.safeParse({
        items: Array.from({ length: 150 }, () => ({ name: "x" })),
      }).success
    ).toBe(true);
    expect(
      SendToBringInputSchema.safeParse({
        items: Array.from({ length: 151 }, () => ({ name: "x" })),
      }).success
    ).toBe(false);
  });
});

describe("SendToBringResultSchema", () => {
  it("takes an https or http deeplink and never another scheme", () => {
    for (const deeplink of ["https://getbring.onelink.me/a", "http://localhost:4010/a"]) {
      expect(SendToBringResultSchema.safeParse({ ok: true, deeplink }).success).toBe(true);
    }
    for (const deeplink of ["javascript:alert(1)", "ftp://x.test/a", "data:text/html,hi"]) {
      expect(SendToBringResultSchema.safeParse({ ok: true, deeplink }).success).toBe(false);
    }
  });
});
