import { errorBody, mobileToastDescription } from "@/lib/platform/toast-description";
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

describe("errorBody", () => {
  it("shows no Zod issue list, as a too long household name answers", () => {
    const issues = [
      { origin: "string", code: "too_big", maximum: 100, path: ["name"], message: "Name too long" },
    ];

    expect(errorBody(new Error(JSON.stringify(issues, null, 2)))).toBeUndefined();
  });

  it("keeps a message the router wrote for the reader", () => {
    expect(errorBody(new Error("This join code has expired"))).toBe("This join code has expired");
    expect(errorBody(new Error("[1, 2]"))).toBe("[1, 2]");
    expect(errorBody("Invalid join code")).toBe("Invalid join code");
  });
});
