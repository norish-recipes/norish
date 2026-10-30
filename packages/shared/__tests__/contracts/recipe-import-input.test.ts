// @vitest-environment node

import { describe, expect, it } from "vitest";

import { RecipeImportInputSchema } from "@norish/shared/contracts/zod";

describe("RecipeImportInputSchema", () => {
  it("fills in https:// for a link typed without a scheme", () => {
    expect(RecipeImportInputSchema.parse({ url: " www.example.com/recipes/udon " }).url).toBe(
      "https://www.example.com/recipes/udon"
    );
  });

  it("keeps a link that already has a scheme", () => {
    expect(RecipeImportInputSchema.parse({ url: "http://example.com/a" }).url).toBe(
      "http://example.com/a"
    );
  });

  it("still refuses what is not a page", () => {
    expect(RecipeImportInputSchema.safeParse({ url: "not a link" }).success).toBe(false);
    expect(RecipeImportInputSchema.safeParse({ url: "" }).success).toBe(false);
  });

  it("refuses a link that is not a web page", () => {
    for (const url of [
      "file:///etc/passwd",
      "gopher://127.0.0.1:6379/_x",
      "javascript://%0aalert(1)",
      "ftp://example.com/recipe",
    ]) {
      expect(RecipeImportInputSchema.safeParse({ url }).success, url).toBe(false);
    }
  });

  it("passes the link on as a browser reads it, so the host checked is the host fetched", () => {
    expect(RecipeImportInputSchema.parse({ url: "https://instagram.com\\@evil.com/x" }).url).toBe(
      "https://instagram.com/@evil.com/x"
    );
    expect(RecipeImportInputSchema.parse({ url: "HTTPS://Example.COM/Udon" }).url).toBe(
      "https://example.com/Udon"
    );
  });
});
