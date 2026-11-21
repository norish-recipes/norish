import { mobileToastDescription } from "@/lib/platform/toast-description";
import { describe, expect, it } from "vitest";

const HINTS = [
  "Check the browser console for technical details",
  "Something went wrong while processing your recipe. Check the browser console for technical details.",
];

describe("mobileToastDescription", () => {
  it("drops every browser-console wording", () => {
    for (const hint of HINTS) expect(mobileToastDescription(hint, HINTS)).toBeUndefined();
  });

  it("keeps any other description, and none", () => {
    expect(mobileToastDescription("Saved offline", HINTS)).toBe("Saved offline");
    expect(mobileToastDescription(undefined, HINTS)).toBeUndefined();
  });
});
