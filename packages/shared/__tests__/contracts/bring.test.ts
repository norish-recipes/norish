import { describe, expect, it } from "vitest";

import {
  BringItemSchema,
  BringListSchema,
  DiscardBringHandoffInputSchema,
  PrepareBringHandoffResultSchema,
  UpdateBringHandoffInputSchema,
} from "../../src/contracts/zod/bring";

const TOKEN = "Ab_-".repeat(8);

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

describe("BringListSchema", () => {
  it("needs at least one item and takes at most 150", () => {
    expect(BringListSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      BringListSchema.safeParse({
        items: Array.from({ length: 150 }, () => ({ name: "x" })),
      }).success
    ).toBe(true);
    expect(
      BringListSchema.safeParse({
        items: Array.from({ length: 151 }, () => ({ name: "x" })),
      }).success
    ).toBe(false);
  });

  it("takes a recipe only by its uuid", () => {
    const items = [{ name: "x" }];

    expect(
      BringListSchema.safeParse({ recipeId: "123e4567-e89b-42d3-a456-426614174000", items }).success
    ).toBe(true);
    expect(BringListSchema.safeParse({ recipeId: "lasagne", items }).success).toBe(false);
  });
});

describe("UpdateBringHandoffInputSchema", () => {
  it("is a list with the 32-character url-safe token prepare returned", () => {
    expect(
      UpdateBringHandoffInputSchema.safeParse({ token: TOKEN, items: [{ name: "x" }] }).success
    ).toBe(true);
    expect(UpdateBringHandoffInputSchema.safeParse({ items: [{ name: "x" }] }).success).toBe(false);
    expect(UpdateBringHandoffInputSchema.safeParse({ token: TOKEN, items: [] }).success).toBe(
      false
    );
  });
});

describe("DiscardBringHandoffInputSchema", () => {
  it("takes a 32-character url-safe token and nothing else", () => {
    expect(DiscardBringHandoffInputSchema.safeParse({ token: TOKEN }).success).toBe(true);
    for (const token of ["", "T".repeat(31), "T".repeat(33), `${"T".repeat(31)}/`, "../x"]) {
      expect(DiscardBringHandoffInputSchema.safeParse({ token }).success).toBe(false);
    }
  });
});

describe("PrepareBringHandoffResultSchema", () => {
  it("takes an https or http deeplink and never another scheme", () => {
    for (const deeplink of ["https://getbring.onelink.me/a", "http://localhost:4010/a"]) {
      expect(
        PrepareBringHandoffResultSchema.safeParse({ ok: true, token: TOKEN, deeplink }).success
      ).toBe(true);
    }
    for (const deeplink of ["javascript:alert(1)", "ftp://x.test/a", "data:text/html,hi"]) {
      expect(
        PrepareBringHandoffResultSchema.safeParse({ ok: true, token: TOKEN, deeplink }).success
      ).toBe(false);
    }
  });

  it("needs the token with a deeplink", () => {
    expect(
      PrepareBringHandoffResultSchema.safeParse({
        ok: true,
        deeplink: "https://getbring.onelink.me/a",
      }).success
    ).toBe(false);
  });

  it("carries a failure's reason and the status the page answered", () => {
    expect(
      PrepareBringHandoffResultSchema.parse({ ok: false, reason: "page-unreachable", status: 403 })
    ).toEqual({ ok: false, reason: "page-unreachable", status: 403 });
    expect(PrepareBringHandoffResultSchema.safeParse({ ok: false, reason: "nope" }).success).toBe(
      false
    );
  });
});
