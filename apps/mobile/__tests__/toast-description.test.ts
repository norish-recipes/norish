import { mobileToastDescription } from "@/lib/platform/toast-description";
import { describe, expect, it } from "vitest";

const BROWSER = "Check the browser console for technical details";

describe("mobileToastDescription", () => {
  it("drops the browser-console wording", () => {
    expect(mobileToastDescription(BROWSER, BROWSER)).toBeUndefined();
  });

  it("keeps any other description, and none", () => {
    expect(mobileToastDescription("Saved offline", BROWSER)).toBe("Saved offline");
    expect(mobileToastDescription(undefined, BROWSER)).toBeUndefined();
  });
});
