// @vitest-environment node
import { describe, expect, it } from "vitest";

import { importLinkCode, isImportLinkCode } from "@norish/config/crypto";

describe("import link code", () => {
  it("is the same every time for one reader, and differs between readers", () => {
    expect(importLinkCode("user-1")).toBe(importLinkCode("user-1"));
    expect(importLinkCode("user-1")).not.toBe(importLinkCode("user-2"));
  });

  it("can travel in a URL untouched", () => {
    expect(encodeURIComponent(importLinkCode("user-1"))).toBe(importLinkCode("user-1"));
  });

  it("accepts a reader's own code", () => {
    expect(isImportLinkCode("user-1", importLinkCode("user-1"))).toBe(true);
  });

  it.each([
    ["another reader's code", importLinkCode("user-2")],
    ["a code of the right length that is wrong", "x".repeat(importLinkCode("user-1").length)],
    ["a short code", "abc"],
    ["an empty code", ""],
  ])("refuses %s", (_name, code) => {
    expect(isImportLinkCode("user-1", code)).toBe(false);
  });
});
